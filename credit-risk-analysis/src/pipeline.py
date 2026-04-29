from __future__ import annotations

from typing import Any, Dict

from explainability import ExplainabilityEngine
from report_generator import ReportGenerator


class AnalysisPipeline:
    """Orchestrate predict -> explain -> generate report."""

    def __init__(self, explainer: ExplainabilityEngine, report_generator: ReportGenerator) -> None:
        self.explainer = explainer
        self.report_generator = report_generator

    def explain(self, company_id: str, top_n: int = 5, verbose: bool = True) -> Dict[str, Any]:
        return self.explainer.explain(company_id=company_id, top_n=top_n, verbose=verbose)

    def explain_features(
        self,
        company_features: Dict[str, Any],
        company_id: str | None = None,
        top_n: int = 5,
        verbose: bool = True,
    ) -> Dict[str, Any]:
        return self.explainer.explain_from_features(
            company_features=company_features,
            company_id=company_id,
            top_n=top_n,
            verbose=verbose,
        )

    def analyze_and_report(
        self,
        company_id: str,
        top_n: int = 5,
        logo_path: str | None = None,
        verbose: bool = True,
    ) -> Dict[str, Any]:
        company_result = self.explain(company_id=company_id, top_n=top_n, verbose=verbose)
        pdf_path = self.report_generator.generate_report(company_result=company_result, logo_path=logo_path)
        return {
            "company_id": company_id,
            "company_result": company_result,
            "pdf_path": pdf_path,
        }

    def analyze_features_and_report(
        self,
        company_features: Dict[str, Any],
        company_id: str | None = None,
        top_n: int = 5,
        logo_path: str | None = None,
        verbose: bool = True,
    ) -> Dict[str, Any]:
        company_result = self.explain_features(
            company_features=company_features,
            company_id=company_id,
            top_n=top_n,
            verbose=verbose,
        )
        pdf_path = self.report_generator.generate_report(company_result=company_result, logo_path=logo_path)
        return {
            "company_id": company_result["company_id"],
            "company_result": company_result,
            "pdf_path": pdf_path,
        }


def run_pipeline(
    company_id: str,
    explainer: ExplainabilityEngine,
    report_generator: ReportGenerator,
    top_n: int = 5,
    logo_path: str | None = None,
    verbose: bool = True,
) -> Dict[str, Any]:
    """Function-style helper for one-shot orchestration."""
    pipeline = AnalysisPipeline(explainer=explainer, report_generator=report_generator)
    return pipeline.analyze_and_report(
        company_id=company_id,
        top_n=top_n,
        logo_path=logo_path,
        verbose=verbose,
    )


def run_pipeline_features(
    company_features: Dict[str, Any],
    explainer: ExplainabilityEngine,
    report_generator: ReportGenerator,
    company_id: str | None = None,
    top_n: int = 5,
    logo_path: str | None = None,
    verbose: bool = True,
) -> Dict[str, Any]:
    """Function-style helper for one-shot feature-based orchestration."""
    pipeline = AnalysisPipeline(explainer=explainer, report_generator=report_generator)
    return pipeline.analyze_features_and_report(
        company_features=company_features,
        company_id=company_id,
        top_n=top_n,
        logo_path=logo_path,
        verbose=verbose,
    )
