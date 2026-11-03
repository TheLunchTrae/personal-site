---
name: test-audit
description: Audit existing test suites for useful coverage, duplication, misleading assertions, and unnecessary test support. Use for a scoped suite assessment or approved test cleanup, including unchanged tests. In this repository, also use it whenever you write, change, or remove unit tests.
---

# Audit an existing test suite

Read `references/testing-standards.md` and applicable repository instructions.
Apply only assigned assessment or implementation. This skill grants no edit, execution, or delegation authority.
Audits are read-only unless approved scope explicitly includes cleanup.

## Establish the scope

Resolve the requested suite, capability, package, or repository. Suite audits include unchanged tests.
Without scope, inventory suites and propose bounded batches. Do not silently sample convenient files
or claim completeness
from a sample.

Read test configuration, CI selection, setup, fixtures, relevant production entry points, and existing test commands.
Identify tests that run in each relevant environment. Record source state and inspected scope.
Use permitted existing commands for baseline evidence. A planner only proposes execution.
Do not add tools or run custom verification scripts to bypass a reviewer's tool restrictions.

## Assess coverage and candidates

Trace candidate assertions through claimed production behavior. Inspect callers, sibling paths, relevant dependency
contracts, overlapping tests, and available history before judging value. Separate evidence from missing history
or uncertain external consumers.

Classify each assessed candidate as retain, consolidate, rewrite, remove, or uncertain, with reasons.
Report important coverage gaps, incorrect test boundaries, and misleading pass conditions.
Optimize confidence and maintenance effort. Do not use a deletion quota or assume that passing tests are useful.

Before recommending a removal or loss of coverage, record:

- The exact test location, claimed contract, and failure its assertions can detect.
- The source of the expected behavior and relevant history, or the limits of available evidence.
- Existing assertions that will still detect that failure, or evidence that the contract is obsolete.
- Production and external consumers of any support code proposed for removal, including dynamic usage risks.
- The proposed change, coverage impact, risk, and focused validation command.

Preserve candidates with missing evidence as uncertain; report the bounded investigation needed.
Shared line execution alone does not make tests redundant.
Keep independently useful compatibility, security, release, storage, and other contracts under the shared standards.
A failing retained contract may reveal a product defect. Report it; do not delete the test to restore green.

## Propose or perform a coherent change

Return findings before edits. Group related changes around one behavior or owning component.
Before rewrites or consolidation remove old proof, identify required assertions and demonstrate replacement coverage.
Preserve uncertainty and risks for the user's reviewed cleanup decision.

Implement only when the role permits edits and reviewed approval covers target files and removals. Reuse same-scope
authorization. Preserve approval requirements for public interfaces and uncertain external consumers.
A test's sole local reference does not prove a production export is unused.
Remove unnecessary helpers or runtime hooks only after their lack of real consumers is established.
Avoid introducing replacement wrappers or tests that reproduce the same weak evidence.

Do not edit a checkout while its tests run. Run available affected tests before and after approved changes.
When replacing static assertions, check sibling coverage and actual executable behavior.
Use `verify` for results and limits. A passing reduced suite alone does not prove that removed coverage was redundant.
Report any unavailable validation without claiming that the cleanup is verified.

## Return the assessment

Report candidate decisions, evidence, coverage gaps, and uncertainty. For cleanup, include changes and verification.
Separate inspected scope from unassessed suites. Report valuable apparent false positives, preserved contracts,
test-support changes, executed checks, and necessary follow-up.
Keep plans and execution logs in conversation or an authorized task location. An audit does not authorize shipping.

## Assessment guidance

The following Reviewer Standards, Review Target, and Review Criteria apply only while assessing the requested suite.
Their read-only conduct does not apply to approved cleanup. Cleanup still requires the assigned role's edit permissions
and reviewed authorization.

# Reviewer Standards

Shared conduct for reviewer agents. Apply this guidance for each review.
The current agent file defines specialty, delegation authority, and stopping conditions.

## Review conduct

Assess the supplied material and report supported findings. Do not edit files or apply fixes.
A review with no findings is valid. Do not invent issues to fill a report.
For diff reviews, prioritize changed material and use unchanged surrounding code as context.
For explicit file or suite audits, assess the complete requested scope, including unchanged material.
Report defects outside the requested scope only for a CRITICAL security issue.
Explain evidence, impact, and an actionable correction.
Use project and language authorities for style findings; read `references/global-coding-style.md` when applicable.
Read `references/testing-standards.md` when assessing test quality, coverage, or a testing design.
Use `test-audit` for an explicit suite audit. Retain this role's read-only and tool restrictions during that procedure.

Use the supplied Review Criteria for severity and verdicts.
Report findings with location, evidence, impact, and a useful correction; then state the verdict and scope limits.
For code reviews, resolve scope with the supplied Review Target. For design reviews, assess the supplied design.

## Verification

Inspect the material manually. Keep the assigned role's tool restrictions; a review skill grants no execution rights.

Assess supplied check evidence and coverage of the change. Do not claim you ran supplied commands.
State commands personally run, their results, unavailable checks, and limits.
Review may proceed with missing or failing checks. Record that status; a finding-based verdict is not merge readiness.
Reuse current, complete evidence for identical scope. Do not claim independent review from your own implementation.

# Review Target

Use the assignment's explicit target or supplied default.
If the target is ambiguous and no default is supplied, report the missing scope before reviewing.

| Target                           | Scope and evidence                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch, PR, MR, or merge request | Confirm the target branch and inspect changes since the merge base, such as `git diff target...HEAD`. State unresolved target or ref currency. |
| Staged                           | Inspect `git diff --cached`.                                                                                                                   |
| Local                            | Inspect tracked changes with `git diff HEAD`, plus `git status --short`; read relevant untracked files separately.                             |
| File path or glob                | Resolve and read the named files. State whether the request covers complete files or only changes.                                             |
| Suite or capability audit        | Include unchanged tests and their production boundaries. Use `test-audit`.                                                                     |

Do not silently substitute a different target or treat a missing commit/ref as an empty diff.
Read surrounding code needed to assess changed behavior. State the source revision or working-tree scope.
Preserve explicit file restrictions when gathering context. Do not read secret files as review material.

# Review Criteria

Shared severity and verdict criteria. Reading this reference does not assign a reviewer role.

| Severity | Impact                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | Security vulnerability, data loss or corruption, complete feature breakage, or unblocked production incident risk.   |
| HIGH     | Significant bug, likely failure-path error, contract mismatch, race condition, or noticeable user-facing defect.     |
| MEDIUM   | Unhandled edge case, fragile assumption, inconsistent pattern, missing unlikely-input validation, or technical debt. |
| LOW      | Minor naming, style, readability, redundancy, or optional improvement.                                               |

Assign severity from actual impact. Domain-specific examples do not override impact.
Set the review verdict to `BLOCKED` for any CRITICAL or HIGH finding. Otherwise use `NOT ASSESSED` when required
review scope remains unassessed, or `PASSED` when the assessment is complete.
A passed review does not prove unrun checks, authorize implementation or shipping, or waive another required review.
Report verification and scope limits separately from the finding-based verdict.
Missing or failing checks do not alone prevent a completed manual assessment. Explain their effect on supported
findings and identify any review scope that could not be assessed. Task completion and review verdict remain separate.

The assessment-only guidance above does not grant edit authority or restrict separately approved cleanup.
