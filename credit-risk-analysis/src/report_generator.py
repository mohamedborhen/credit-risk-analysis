from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import shap
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class ReportGenerator:
    """Generate credit risk PDF reports and SHAP plot images."""

    def __init__(self, output_dir: str = "reports", max_display: int = 10) -> None:
        self.output_dir = Path(output_dir)
        self.max_display = max_display

    @staticmethod
    def _safe_file_token(value: str) -> str:
        token = re.sub(r"[^A-Za-z0-9_-]+", "_", value).strip("_")
        return token if token else "company"

    @staticmethod
    def _feature_display_name(feature: str) -> str:
        mapping = {
            "profit_margin": "Profitability level",
            "formal_worker_ratio": "Workforce formalization level",
            "workers_verified_cnss": "Verified workforce compliance",
            "nbr_of_workers": "Company size",
            "business_age_years": "Business maturity",
            "number_of_owners": "Ownership structure",
            "business_turnover_tnd_log": "Revenue strength",
            "business_expenses_tnd_log": "Expense efficiency",
            "compliance_rne_score": "Regulatory compliance profile",
            "steg_sonede_score": "Utility payment discipline",
            "banking_maturity_score": "Banking maturity",
            "followers_fcb_log": "Facebook presence",
            "followers_insta_log": "Instagram presence",
            "followers_linkedin_log": "LinkedIn presence",
            "posts_per_month": "Digital activity consistency",
        }
        if feature in mapping:
            return mapping[feature]
        if feature.startswith("biz_"):
            return f"Business sector ({feature.replace('biz_', '').replace('_', ' ')})"
        return feature.replace("_", " ").replace("log", "").strip().title()

    @staticmethod
    def _impact_label(abs_shap: float, positive: bool) -> str:
        if abs_shap >= 1.0:
            level = "Strong"
        elif abs_shap >= 0.45:
            level = "Moderate"
        else:
            level = "Light"
        direction = "positive" if positive else "negative"
        return f"{level} {direction} impact"

    @staticmethod
    def _strip_shap_numeric(text: str) -> str:
        return re.sub(r"\s*\[SHAP=[^\]]+\]", "", text).strip()

    @classmethod
    def _build_strength_text(cls, feature: str, shap_value: float) -> str:
        name = cls._feature_display_name(feature)
        impact = cls._impact_label(abs(float(shap_value)), positive=True)
        reason_map = {
            "Profitability level": "strong margins improve repayment capacity",
            "Workforce formalization level": "formal employment structure increases operational trust",
            "Verified workforce compliance": "verified payroll records strengthen credibility",
            "Regulatory compliance profile": "good compliance lowers governance risk",
            "Banking maturity": "stable banking behavior supports financing confidence",
            "Revenue strength": "healthy revenue level supports debt service capacity",
            "Expense efficiency": "controlled costs support stronger cash generation",
        }
        reason = reason_map.get(name, "this indicator supports financing readiness")
        return f"{name}: {reason}. {impact}."

    @classmethod
    def _build_weakness_text(cls, feature: str, shap_value: float) -> str:
        name = cls._feature_display_name(feature)
        impact = cls._impact_label(abs(float(shap_value)), positive=False)
        reason_map = {
            "Company size": "the current company size may limit operational scalability and increases perceived risk",
            "Workforce formalization level": "a lower level of formalization reduces transparency for lenders",
            "Verified workforce compliance": "limited verified employee records weaken confidence in operational discipline",
            "Regulatory compliance profile": "compliance gaps raise governance and legal risk concerns",
            "Utility payment discipline": "irregular utility behavior can indicate cash-flow pressure",
            "Banking maturity": "limited banking depth reduces confidence in financial traceability",
            "Revenue strength": "lower recurring revenue weakens debt repayment comfort",
            "Expense efficiency": "high operating costs reduce resilience under financial stress",
            "Instagram presence": "limited digital footprint may indicate weaker market traction",
            "Digital activity consistency": "inconsistent digital activity can signal unstable commercial momentum",
        }
        reason = reason_map.get(name, "this factor currently increases perceived financing risk")
        return f"{name}: {reason}. {impact}."

    @classmethod
    def _build_business_strengths(cls, company_result: Dict[str, Any], limit: int = 5) -> List[str]:
        strengths_df = company_result.get("shap_strengths_df")
        if strengths_df is not None and hasattr(strengths_df, "iterrows") and len(strengths_df) > 0:
            out: List[str] = []
            for _, row in strengths_df.head(limit).iterrows():
                out.append(cls._build_strength_text(str(row["feature"]), float(row["shap_value"])))
            return out

        raw_strengths = company_result.get("strengths", [])
        return [cls._strip_shap_numeric(str(s)) for s in raw_strengths[:limit]]

    @classmethod
    def _build_business_weaknesses(cls, company_result: Dict[str, Any], limit: int = 5) -> List[str]:
        weaknesses_df = company_result.get("shap_weaknesses_df")
        if weaknesses_df is not None and hasattr(weaknesses_df, "iterrows") and len(weaknesses_df) > 0:
            out: List[str] = []
            for _, row in weaknesses_df.head(limit).iterrows():
                out.append(cls._build_weakness_text(str(row["feature"]), float(row["shap_value"])))
            return out

        raw_weaknesses = company_result.get("weaknesses", [])
        return [cls._strip_shap_numeric(str(w)) for w in raw_weaknesses[:limit]]

    @staticmethod
    def _risk_segment_explanation(risk_label: str) -> str:
        mapping = {
            "Low Risk": "Low Risk indicates a high probability of repayment based on financial and behavioral indicators.",
            "Medium Risk": "Medium Risk indicates mixed signals and typically requires additional review before final approval.",
            "High Risk": "High Risk indicates elevated repayment uncertainty and requires substantial improvement before financing.",
        }
        return mapping.get(risk_label, "Risk tier is based on modeled repayment probability and operational indicators.")

    @classmethod
    def _decision_business_rationale(cls, company_result: Dict[str, Any]) -> str:
        decision = str(company_result.get("decision", ""))
        strengths = company_result.get("strength_features", [])[:3]
        pretty = [cls._feature_display_name(f) for f in strengths]
        if pretty:
            joined = ", ".join(pretty[:-1] + [pretty[-1]]) if len(pretty) == 1 else ", ".join(pretty[:-1]) + f", and {pretty[-1]}"
        else:
            joined = "the overall financial and behavioral profile"

        if "Approved" in decision:
            return f"The company is approved due to strong performance in {joined}."
        if "Manual Review" in decision:
            return f"The company is placed under manual review because strengths in {joined} are partially offset by risk factors that require validation."
        return f"The current profile is not approved because weaknesses outweigh strengths in {joined}."

    @staticmethod
    def _conclusion_text(risk_label: str) -> str:
        if risk_label == "Low Risk":
            return "The company demonstrates strong financial health and operational discipline, making it a suitable candidate for financing."
        if risk_label == "Medium Risk":
            return "The company shows financing potential, but selected risk factors should be addressed before final commitment."
        return "The current profile indicates elevated risk; targeted improvements are required before financing can be considered."

    @staticmethod
    def _recommendations_from_weaknesses(weakness_features: List[str]) -> List[str]:
        rec_map = {
            "compliance_rne_score": "Improve legal and administrative compliance documentation (RNE updates, filing regularity).",
            "steg_sonede_score": "Improve utility payment regularity to strengthen operational stability signals.",
            "banking_maturity_score": "Build stronger banking history with regular transactions and formal financial traces.",
            "profit_margin": "Increase operating margin through pricing optimization and cost control.",
            "formal_worker_ratio": "Increase formal employment ratio with verifiable CNSS declarations.",
            "workers_verified_cnss": "Improve workforce verification by keeping employee declarations up to date.",
            "business_turnover_tnd_log": "Improve recurring revenues and reduce sales volatility over upcoming quarters.",
            "business_expenses_tnd_log": "Control expenses to improve net profitability and cash generation.",
            "posts_per_month": "Strengthen monthly digital activity to improve behavioral business signals.",
            "followers_fcb_log": "Develop social media presence and audience engagement to improve visibility signals.",
            "followers_insta_log": "Develop social media presence and audience engagement to improve visibility signals.",
            "followers_linkedin_log": "Develop social media presence and audience engagement to improve visibility signals.",
        }
        recommendations: List[str] = []
        for feat in weakness_features:
            if feat in rec_map:
                recommendations.append(rec_map[feat])

        if not recommendations:
            recommendations.append(
                "Maintain financial discipline and improve documentation quality for the next review cycle."
            )

        return list(dict.fromkeys(recommendations))[:5]

    @staticmethod
    def _build_shap_explanation(plot_payload: Dict[str, Any]) -> shap.Explanation:
        return shap.Explanation(
            values=np.array(plot_payload["shap_values"], dtype=float),
            base_values=float(plot_payload["expected_value"]),
            data=np.array(plot_payload["feature_values"], dtype=float),
            feature_names=list(plot_payload["feature_names"]),
        )

    def _create_shap_plot_images(self, company_result: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
        plot_payload = company_result.get("shap_plot_data")
        if not plot_payload:
            return {}

        company_name = str(company_result.get("company_info", {}).get("company_name") or company_result.get("company_id", "company"))
        company_token = self._safe_file_token(company_name)
        shap_dir = self.output_dir / "shap_plots"
        shap_dir.mkdir(parents=True, exist_ok=True)

        output: Dict[str, Dict[str, str]] = {}
        for model_key in ["m1", "m2"]:
            if model_key not in plot_payload:
                continue

            exp = self._build_shap_explanation(plot_payload[model_key])
            label = plot_payload[model_key].get("label", model_key)

            bar_path = shap_dir / f"{company_token}_{model_key}_bar.png"
            try:
                plt.figure(figsize=(10, 5))
                shap.plots.bar(exp, max_display=self.max_display, show=False)
                plt.tight_layout()
                plt.savefig(bar_path, dpi=180, bbox_inches="tight")
                plt.close()
            except Exception:
                abs_vals = np.abs(np.array(exp.values, dtype=float))
                names = np.array(exp.feature_names)
                order = np.argsort(abs_vals)[::-1][: self.max_display]
                abs_top = abs_vals[order]
                names_top = names[order]
                plt.figure(figsize=(10, 5))
                plt.barh(names_top[::-1], abs_top[::-1], color="#1F77B4")
                plt.xlabel("|SHAP value|")
                plt.title(f"{label} - Top Feature Impact (Absolute SHAP)")
                plt.tight_layout()
                plt.savefig(bar_path, dpi=180, bbox_inches="tight")
                plt.close()

            output[model_key] = {
                "label": label,
                "bar": str(bar_path),
            }

        return output

    def generate_report(self, company_result: Dict[str, Any], logo_path: str | None = None) -> str:
        """Generate a PDF report named Report_<CompanyID>.pdf and return its path."""
        self.output_dir.mkdir(parents=True, exist_ok=True)

        company_name = str(company_result.get("company_info", {}).get("company_name") or company_result.get("company_id", "company"))
        report_path = self.output_dir / f"Report_{self._safe_file_token(company_name)}.pdf"

        doc = SimpleDocTemplate(
            str(report_path),
            pagesize=A4,
            rightMargin=1.8 * cm,
            leftMargin=1.8 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "TitleCustom",
            parent=styles["Title"],
            fontSize=20,
            textColor=colors.HexColor("#0B3C5D"),
        )
        section_style = ParagraphStyle(
            "SectionCustom",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=colors.HexColor("#102A43"),
            spaceBefore=10,
            spaceAfter=8,
        )
        body_style = ParagraphStyle(
            "BodyCustom",
            parent=styles["BodyText"],
            fontSize=10.5,
            leading=15,
        )
        emphasis_style = ParagraphStyle(
            "Emphasis",
            parent=body_style,
            fontName="Helvetica-Bold",
        )
        score_title_style = ParagraphStyle(
            "ScoreTitle",
            parent=styles["Heading1"],
            fontSize=12,
            textColor=colors.HexColor("#486581"),
            alignment=1,
        )
        score_value_style = ParagraphStyle(
            "ScoreValue",
            parent=styles["Heading1"],
            fontSize=34,
            leading=36,
            alignment=1,
            textColor=colors.HexColor("#102A43"),
        )

        story: List[Any] = []

        if logo_path and Path(logo_path).exists():
            logo = Image(str(logo_path), width=2.4 * cm, height=2.4 * cm)
            header_tbl = Table(
                [[logo, Paragraph("Credit Risk Assessment Report", title_style)]],
                colWidths=[2.8 * cm, 14.2 * cm],
            )
            header_tbl.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ]
                )
            )
            story.append(header_tbl)
        else:
            story.append(Paragraph("Credit Risk Assessment Report", title_style))
        story.append(Spacer(1, 0.45 * cm))

        info = company_result["company_info"]
        story.append(Paragraph("Company Information", section_style))
        company_display_name = str(info.get("company_name") or info.get("id") or company_result.get("company_id", "Unknown"))
        info_data = [
            ["Company Name", company_display_name],
            ["Sector", str(info["sector"])],
            ["Age (years)", str(info["age_years"])],
            ["Workforce", str(info["workforce"])],
        ]
        info_table = Table(info_data, colWidths=[4.2 * cm, 10.8 * cm])
        info_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EEF3FB")),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1B263B")),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#BFC9D9")),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(info_table)
        story.append(Spacer(1, 0.45 * cm))

        score = company_result["score"]
        risk = company_result["risk_label"]
        risk_color = {
            "Low Risk": "#2E7D32",
            "Medium Risk": "#EF6C00",
            "High Risk": "#C62828",
        }.get(risk, "#333333")
        risk_bg = {
            "Low Risk": "#E8F5E9",
            "Medium Risk": "#FFF3E0",
            "High Risk": "#FFEBEE",
        }.get(risk, "#F5F7FA")
        story.append(Paragraph("Score", section_style))

        score_block = Table(
            [
                [Paragraph("SCORE", score_title_style)],
                [Paragraph(f"<b>{score} / 100</b>", score_value_style)],
                [Paragraph(f"<font color=\"{risk_color}\"><b>{risk}</b></font>", emphasis_style)],
            ],
            colWidths=[17.0 * cm],
        )
        score_block.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(risk_bg)),
                    ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#CBD2D9")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(score_block)
        story.append(Spacer(1, 0.2 * cm))
        story.append(Paragraph(self._risk_segment_explanation(risk), body_style))
        story.append(Spacer(1, 0.35 * cm))

        story.append(Paragraph("Decision", section_style))
        story.append(Paragraph(f"Decision Status: <b>{company_result['decision']}</b>", body_style))
        story.append(Paragraph(self._decision_business_rationale(company_result), body_style))
        story.append(Paragraph(company_result["decision_explanation"], body_style))
        story.append(Spacer(1, 0.35 * cm))

        story.append(Paragraph("Strengths", section_style))
        strengths_text = self._build_business_strengths(company_result, limit=5)
        if strengths_text:
            for item in strengths_text:
                story.append(Paragraph(f"- {item}", body_style))
        else:
            story.append(
                Paragraph(
                    "No major positive drivers detected for the selected top features.",
                    body_style,
                )
            )
        story.append(Spacer(1, 0.35 * cm))

        story.append(Paragraph("Weaknesses", section_style))
        weaknesses_text = self._build_business_weaknesses(company_result, limit=5)
        if weaknesses_text:
            for item in weaknesses_text:
                story.append(Paragraph(f"- {item}", body_style))
        else:
            story.append(
                Paragraph(
                    "No major negative drivers detected for the selected top features.",
                    body_style,
                )
            )
        story.append(Spacer(1, 0.35 * cm))

        shap_plot_files = self._create_shap_plot_images(company_result)
        if shap_plot_files:
            story.append(Paragraph("SHAP Explainability Plots", section_style))
            story.append(
                Paragraph(
                    "The following charts show how each factor contributed to the final score. The bar chart highlights the strongest positive and negative drivers.",
                    body_style,
                )
            )
            story.append(Spacer(1, 0.2 * cm))
            for model_key in ["m1", "m2"]:
                if model_key not in shap_plot_files:
                    continue
                model_label = shap_plot_files[model_key]["label"]
                bar_path = shap_plot_files[model_key]["bar"]

                story.append(Paragraph(f"<b>{model_label}</b> - Feature Impact Bar Plot", body_style))
                story.append(Image(bar_path, width=16.0 * cm, height=8.0 * cm))
                story.append(Spacer(1, 0.35 * cm))

        story.append(Paragraph("Conclusion", section_style))
        recommendations = self._recommendations_from_weaknesses(company_result["weakness_features"])
        story.append(Paragraph(self._conclusion_text(risk), body_style))
        story.append(Spacer(1, 0.15 * cm))
        story.append(Paragraph("Recommended improvements:", emphasis_style))
        for rec in recommendations:
            story.append(Paragraph(f"- {rec}", body_style))

        doc.build(story)
        print(f"PDF report saved to: {report_path}")
        return str(report_path)


def generate_credit_risk_report(
    company_result: Dict[str, Any],
    output_dir: str = "reports",
    logo_path: str | None = None,
    max_display: int = 10,
) -> str:
    """Compatibility helper for function-style usage."""
    generator = ReportGenerator(output_dir=output_dir, max_display=max_display)
    return generator.generate_report(company_result=company_result, logo_path=logo_path)
