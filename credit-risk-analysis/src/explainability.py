from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd
import shap


class ExplainabilityEngine:
    """Compute per-company predictions and SHAP-based explanations for stacked models."""

    def __init__(
        self,
        df: pd.DataFrame,
        df_clean: pd.DataFrame,
        model1: Any,
        model2: Any,
        meta_model: Any,
        scaler_m1: Any,
        scaler_m2: Any,
        m1_features_processed: List[str],
        m2_features_all: List[str],
    ) -> None:
        self.df = df
        self.df_clean = df_clean
        self.model1 = model1
        self.model2 = model2
        self.meta_model = meta_model
        self.scaler_m1 = scaler_m1
        self.scaler_m2 = scaler_m2
        self.m1_features_processed = list(m1_features_processed)
        self.m2_features_all = list(m2_features_all)

    @staticmethod
    def _extract_single_shap_vector(shap_values: Any) -> np.ndarray:
        """Handle SHAP output differences across tree models and versions."""
        if isinstance(shap_values, list):
            if len(shap_values) > 1:
                arr = np.array(shap_values[1])
            else:
                arr = np.array(shap_values[0])
        else:
            arr = np.array(shap_values)

        if arr.ndim == 3:
            if arr.shape[-1] > 1:
                return arr[0, :, 1]
            return arr[0, :, 0]
        if arr.ndim == 2:
            return arr[0]
        return arr

    @staticmethod
    def _extract_expected_value(expected_value: Any) -> float:
        arr = np.array(expected_value)
        if arr.ndim == 0:
            return float(arr)
        flat = arr.reshape(-1)
        if len(flat) == 0:
            return 0.0
        return float(flat[-1])

    @staticmethod
    def decision_from_probability(prob: float) -> tuple[int, str, str, str]:
        score = int(round(prob * 100))
        if prob >= 0.67:
            return (
                score,
                "Low Risk",
                "Approved",
                "The solvability signal is strong across both model layers.",
            )
        if prob >= 0.45:
            return (
                score,
                "Medium Risk",
                "Medium Risk / Manual Review",
                "The profile is borderline and should be reviewed with supporting documents.",
            )
        return (
            score,
            "High Risk",
            "Rejected",
            "The predicted solvability is weak and risk factors dominate.",
        )

    @staticmethod
    def _humanize_feature_name(feature: str) -> str:
        if feature.startswith("biz_"):
            return "business type: " + feature.replace("biz_", "").replace("_", " ")
        return feature.replace("_log", "").replace("_", " ")

    @classmethod
    def _feature_sentence(cls, feature: str, value: float, shap_value: float) -> str:
        direction = "supports financing eligibility" if shap_value > 0 else "increases financing risk"
        if feature.startswith("biz_"):
            if value >= 0.5:
                text = f"Company sector ({cls._humanize_feature_name(feature)}) {direction}."
            else:
                text = (
                    f"Sector indicator ({cls._humanize_feature_name(feature)}) "
                    "is inactive and has limited impact."
                )
        else:
            text = f"{cls._humanize_feature_name(feature).title()} is {value:.3f} and {direction}."
        return f"{text} [SHAP={shap_value:+.4f}]"

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            fval = float(value)
            if np.isnan(fval):
                return default
            return fval
        except Exception:
            return default

    def _default_for_feature(self, feature: str) -> float:
        if feature in self.df_clean.columns:
            series = pd.to_numeric(self.df_clean[feature], errors="coerce")
            med = series.median()
            if pd.notna(med):
                return float(med)
        if feature in self.df.columns:
            series = pd.to_numeric(self.df[feature], errors="coerce")
            med = series.median()
            if pd.notna(med):
                return float(med)
        return 0.0

    def _build_vectors_from_features(self, company_features: Dict[str, Any]) -> tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any], str]:
        features = dict(company_features)
        input_company_id = str(features.get("id", "") or "").strip()
        input_company_name = str(features.get("company_name", features.get("name", "")) or "").strip()
        company_id = input_company_id if input_company_id else (input_company_name if input_company_name else "CUSTOM_INPUT")
        company_name = input_company_name if input_company_name else (input_company_id if input_company_id else "New Company")

        business_type = str(features.get("type_of_business", "") or "").strip()

        m1_values: Dict[str, float] = {}
        for feat in self.m1_features_processed:
            if feat in features and features[feat] is not None:
                m1_values[feat] = self._safe_float(features[feat], default=self._default_for_feature(feat))
                continue

            if feat.endswith("_log"):
                raw_feat = feat[:-4]
                if raw_feat in features and features[raw_feat] is not None:
                    raw_val = max(self._safe_float(features[raw_feat], default=0.0), 0.0)
                    m1_values[feat] = float(np.log1p(raw_val))
                    continue

            m1_values[feat] = self._default_for_feature(feat)

        m2_values: Dict[str, float] = {}
        for feat in self.m2_features_all:
            if feat.startswith("biz_"):
                if feat in features and features[feat] is not None:
                    m2_values[feat] = self._safe_float(features[feat], default=0.0)
                else:
                    sector = feat.replace("biz_", "")
                    m2_values[feat] = 1.0 if business_type == sector else 0.0
                continue

            if feat in features and features[feat] is not None:
                m2_values[feat] = self._safe_float(features[feat], default=self._default_for_feature(feat))
                continue

            if feat.endswith("_log"):
                raw_feat = feat[:-4]
                if raw_feat in features and features[raw_feat] is not None:
                    raw_val = max(self._safe_float(features[raw_feat], default=0.0), 0.0)
                    m2_values[feat] = float(np.log1p(raw_val))
                    continue

            m2_values[feat] = self._default_for_feature(feat)

        x_m1 = pd.DataFrame([m1_values], columns=self.m1_features_processed)
        x_m2 = pd.DataFrame([m2_values], columns=self.m2_features_all)

        company_info = {
            "id": company_id,
            "company_name": company_name,
            "sector": business_type if business_type else "Unknown",
            "age_years": int(round(self._safe_float(features.get("business_age_years", 0), default=0.0))),
            "workforce": int(round(self._safe_float(features.get("nbr_of_workers", 0), default=0.0))),
        }

        return x_m1, x_m2, company_info, company_id

    def _score_and_explain(
        self,
        company_id: str,
        company_info: Dict[str, Any],
        x_m1: pd.DataFrame,
        x_m2: pd.DataFrame,
        top_n: int,
        verbose: bool,
    ) -> Dict[str, Any]:
        x_m1_sc = self.scaler_m1.transform(x_m1)
        x_m2_sc = self.scaler_m2.transform(x_m2)

        p1 = float(self.model1.predict_proba(x_m1_sc)[:, 1][0])
        p2 = float(self.model2.predict_proba(x_m2_sc)[:, 1][0])
        p_final = float(self.meta_model.predict_proba(np.array([[p1, p2]]))[:, 1][0])

        score, risk_label, decision_label, decision_explanation = self.decision_from_probability(p_final)

        explainer_m1 = shap.TreeExplainer(self.model1)
        explainer_m2 = shap.TreeExplainer(self.model2)

        shap_m1 = self._extract_single_shap_vector(explainer_m1.shap_values(x_m1_sc))
        shap_m2 = self._extract_single_shap_vector(explainer_m2.shap_values(x_m2_sc))
        expected_m1 = self._extract_expected_value(explainer_m1.expected_value)
        expected_m2 = self._extract_expected_value(explainer_m2.expected_value)

        m1_df = pd.DataFrame(
            {
                "model": "Model 1 (Financial)",
                "feature": self.m1_features_processed,
                "value": x_m1.iloc[0].values,
                "shap_value": shap_m1,
            }
        )
        m2_df = pd.DataFrame(
            {
                "model": "Model 2 (Behavioral)",
                "feature": self.m2_features_all,
                "value": x_m2.iloc[0].values,
                "shap_value": shap_m2,
            }
        )
        shap_all = pd.concat([m1_df, m2_df], ignore_index=True)

        strengths_df = (
            shap_all[shap_all["shap_value"] > 0]
            .sort_values("shap_value", ascending=False)
            .head(top_n)
        )
        weaknesses_df = (
            shap_all[shap_all["shap_value"] < 0]
            .sort_values("shap_value", ascending=True)
            .head(top_n)
        )

        strengths = [
            self._feature_sentence(r["feature"], float(r["value"]), float(r["shap_value"]))
            for _, r in strengths_df.iterrows()
        ]
        weaknesses = [
            self._feature_sentence(r["feature"], float(r["value"]), float(r["shap_value"]))
            for _, r in weaknesses_df.iterrows()
        ]

        result: Dict[str, Any] = {
            "company_id": company_id,
            "company_info": company_info,
            "probabilities": {
                "model1_financial": p1,
                "model2_behavioral": p2,
                "stacked_final": p_final,
            },
            "score": score,
            "risk_label": risk_label,
            "decision": decision_label,
            "decision_explanation": decision_explanation,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "strength_features": strengths_df["feature"].tolist(),
            "weakness_features": weaknesses_df["feature"].tolist(),
            "shap_strengths_df": strengths_df,
            "shap_weaknesses_df": weaknesses_df,
            "shap_full_df": shap_all.sort_values("shap_value", key=np.abs, ascending=False),
            "shap_plot_data": {
                "m1": {
                    "label": "Model 1 (Financial)",
                    "feature_names": list(self.m1_features_processed),
                    "feature_values": x_m1.iloc[0].astype(float).tolist(),
                    "shap_values": np.array(shap_m1, dtype=float).tolist(),
                    "expected_value": float(expected_m1),
                },
                "m2": {
                    "label": "Model 2 (Behavioral)",
                    "feature_names": list(self.m2_features_all),
                    "feature_values": x_m2.iloc[0].astype(float).tolist(),
                    "shap_values": np.array(shap_m2, dtype=float).tolist(),
                    "expected_value": float(expected_m2),
                },
            },
        }

        if verbose:
            print(f"Company: {result['company_id']}")
            print(f"Model 1 probability: {p1:.4f}")
            print(f"Model 2 probability: {p2:.4f}")
            print(f"Stacked probability: {p_final:.4f}")
            print(f"Score: {score}/100 | Risk: {risk_label} | Decision: {decision_label}")

            print("\nTop strengths (SHAP +):")
            for i, item in enumerate(strengths, start=1):
                print(f"{i}. {item}")

            print("\nTop weaknesses (SHAP -):")
            for i, item in enumerate(weaknesses, start=1):
                print(f"{i}. {item}")

        return result

    def explain(self, company_id: str, top_n: int = 5, verbose: bool = True) -> Dict[str, Any]:
        if "id" not in self.df.columns:
            raise ValueError("Missing 'id' column in raw dataframe.")

        idx_list = self.df.index[self.df["id"] == company_id].tolist()
        if not idx_list:
            raise ValueError(f"Company id {company_id} not found in df['id'].")
        if len(idx_list) > 1:
            raise ValueError(f"Company id {company_id} is not unique in df['id'].")

        idx = idx_list[0]
        raw_row = self.df.loc[idx]
        proc_row = self.df_clean.loc[[idx]].copy()

        x_m1 = proc_row.reindex(columns=self.m1_features_processed, fill_value=0)
        x_m2 = proc_row.reindex(columns=self.m2_features_all, fill_value=0)
        company_info = {
            "id": raw_row["id"],
            "company_name": str(raw_row["company_name"]) if "company_name" in raw_row.index else str(raw_row["id"]),
            "sector": raw_row["type_of_business"],
            "age_years": int(raw_row["business_age_years"]),
            "workforce": int(raw_row["nbr_of_workers"]),
        }

        return self._score_and_explain(
            company_id=company_id,
            company_info=company_info,
            x_m1=x_m1,
            x_m2=x_m2,
            top_n=top_n,
            verbose=verbose,
        )

    def explain_from_features(
        self,
        company_features: Dict[str, Any],
        company_id: str | None = None,
        top_n: int = 5,
        verbose: bool = True,
    ) -> Dict[str, Any]:
        x_m1, x_m2, company_info, inferred_company_id = self._build_vectors_from_features(company_features)
        final_company_id = company_id if company_id else inferred_company_id
        company_info["id"] = final_company_id
        if not company_info.get("company_name"):
            company_info["company_name"] = final_company_id

        return self._score_and_explain(
            company_id=final_company_id,
            company_info=company_info,
            x_m1=x_m1,
            x_m2=x_m2,
            top_n=top_n,
            verbose=verbose,
        )


def explain_company_prediction(
    company_id: str,
    *,
    df: pd.DataFrame,
    df_clean: pd.DataFrame,
    model1: Any,
    model2: Any,
    meta_model: Any,
    scaler_m1: Any,
    scaler_m2: Any,
    m1_features_processed: List[str],
    m2_features_all: List[str],
    top_n: int = 5,
    verbose: bool = True,
) -> Dict[str, Any]:
    """Compatibility helper for function-style usage."""
    engine = ExplainabilityEngine(
        df=df,
        df_clean=df_clean,
        model1=model1,
        model2=model2,
        meta_model=meta_model,
        scaler_m1=scaler_m1,
        scaler_m2=scaler_m2,
        m1_features_processed=m1_features_processed,
        m2_features_all=m2_features_all,
    )
    return engine.explain(company_id=company_id, top_n=top_n, verbose=verbose)


def explain_company_features(
    company_features: Dict[str, Any],
    *,
    df: pd.DataFrame,
    df_clean: pd.DataFrame,
    model1: Any,
    model2: Any,
    meta_model: Any,
    scaler_m1: Any,
    scaler_m2: Any,
    m1_features_processed: List[str],
    m2_features_all: List[str],
    company_id: str | None = None,
    top_n: int = 5,
    verbose: bool = True,
) -> Dict[str, Any]:
    """Compatibility helper for feature-input usage."""
    engine = ExplainabilityEngine(
        df=df,
        df_clean=df_clean,
        model1=model1,
        model2=model2,
        meta_model=meta_model,
        scaler_m1=scaler_m1,
        scaler_m2=scaler_m2,
        m1_features_processed=m1_features_processed,
        m2_features_all=m2_features_all,
    )
    return engine.explain_from_features(
        company_features=company_features,
        company_id=company_id,
        top_n=top_n,
        verbose=verbose,
    )
