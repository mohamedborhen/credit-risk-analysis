from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib

from explainability import ExplainabilityEngine
from pipeline import AnalysisPipeline
from report_generator import ReportGenerator


def build_pipeline_from_artifacts(artifacts_dir: Path, output_dir: Path, max_display: int) -> AnalysisPipeline:
    params = joblib.load(artifacts_dir / "training_params.joblib")

    explainer = ExplainabilityEngine(
        df=joblib.load(artifacts_dir / "df_raw.joblib"),
        df_clean=joblib.load(artifacts_dir / "df_clean.joblib"),
        model1=joblib.load(artifacts_dir / "model1_gb.joblib"),
        model2=joblib.load(artifacts_dir / "model2_rf.joblib"),
        meta_model=joblib.load(artifacts_dir / "meta_model_lr.joblib"),
        scaler_m1=joblib.load(artifacts_dir / "scaler_m1.joblib"),
        scaler_m2=joblib.load(artifacts_dir / "scaler_m2.joblib"),
        m1_features_processed=params["m1_features_processed"],
        m2_features_all=params["m2_features_all"],
    )

    reporter = ReportGenerator(output_dir=str(output_dir), max_display=max_display)
    return AnalysisPipeline(explainer=explainer, report_generator=reporter)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate credit report from saved artifacts (predict -> explain -> report)."
    )
    parser.add_argument(
        "company_id",
        nargs="?",
        default=None,
        help="Company identifier from training dataset, e.g. PME_000023",
    )
    parser.add_argument("--top-n", type=int, default=5, help="Top SHAP strengths/weaknesses to include")
    parser.add_argument("--logo-path", default=None, help="Optional logo path for PDF header")
    parser.add_argument("--max-display", type=int, default=10, help="Max features in SHAP plots")
    parser.add_argument(
        "--features-json",
        default=None,
        help="Inline JSON object with company features (for companies not in dataset)",
    )
    parser.add_argument(
        "--features-file",
        default=None,
        help="Path to JSON file containing company features",
    )
    parser.add_argument(
        "--custom-company-id",
        default=None,
        help="Optional custom id used in report name when using feature input",
    )
    parser.add_argument(
        "--artifacts-dir",
        default=str(Path(__file__).resolve().parent / "artifacts"),
        help="Directory containing saved .joblib artifacts",
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parents[1] / "reports"),
        help="Directory for generated PDF and SHAP images",
    )

    args = parser.parse_args()

    artifacts_dir = Path(args.artifacts_dir)
    output_dir = Path(args.output_dir)

    if not artifacts_dir.exists():
        raise FileNotFoundError(f"Artifacts directory not found: {artifacts_dir}")

    if args.features_json and args.features_file:
        parser.error("Use only one of --features-json or --features-file.")

    pipeline = build_pipeline_from_artifacts(
        artifacts_dir=artifacts_dir,
        output_dir=output_dir,
        max_display=args.max_display,
    )

    company_features = None
    if args.features_json:
        company_features = json.loads(args.features_json)
    elif args.features_file:
        features_path = Path(args.features_file)
        if not features_path.exists():
            raise FileNotFoundError(f"Features file not found: {features_path}")
        company_features = json.loads(features_path.read_text(encoding="utf-8"))

    if company_features is not None:
        if not isinstance(company_features, dict):
            raise ValueError("Feature payload must be a JSON object/dictionary.")
        result = pipeline.analyze_features_and_report(
            company_features=company_features,
            company_id=args.custom_company_id or args.company_id,
            top_n=args.top_n,
            logo_path=args.logo_path,
        )
    else:
        if not args.company_id:
            parser.error(
                "Provide dataset company_id OR provide --features-json/--features-file for new company input."
            )
        result = pipeline.analyze_and_report(
            company_id=args.company_id,
            top_n=args.top_n,
            logo_path=args.logo_path,
        )

    print("\n=== Report Generation Complete ===")
    print(f"Company ID: {result['company_id']}")
    print(f"PDF: {result['pdf_path']}")


if __name__ == "__main__":
    main()
