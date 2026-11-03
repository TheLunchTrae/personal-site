# Testing standards

Apply when planning, writing, reviewing, or removing tests. Follow project and language rules within assigned scope,
permissions, and approved verification boundaries.
Read `verification-scope.md` in this folder before applying these standards. Honor its separate limits on discovery,
test generation, execution, and infrastructure changes throughout the work.

## Decide what evidence is needed

For each proposed test or material test change, identify:

- The observable behavior or independently defined contract, and the source of its expected result.
- A plausible defect that the assertions would detect. Check that failure would occur for the intended reason.
- The gap in existing coverage. Reuse or extend sufficient tests before adding another case or test layer.
- The real entry point and dependencies needed to observe that defect, including any limits introduced by substitutes.

Use the least costly level that can prove the claim. Unit checks can cover detailed rules, integration checks can
cover collaborating components, and end-to-end checks can cover complete application journeys.
Do not repeat every case at every level. Explain the distinct risk when more than one level covers related behavior.
Load `end-to-end-tests` when a changed user journey or integration risk needs coverage through the application.
Do not require an end-to-end test for every small edit or an arbitrary coverage percentage.

Prefer public behavior and established interfaces. Do not expose private functions or add runtime flags solely to test
incidental implementation details. Explicitly propose needed testability changes and preserve production contracts.
Legitimate dependency boundaries and stable test identifiers are not inherently bad test seams.

Honor approved exclusions and verification limits; report their effects in the coverage map and handoff.
Do not invent checklist infrastructure work or report excluded checks as passing.

## Inspect the test's claim

Use independent expectations from requirements, public contracts, approved examples, or reference data.
If observed behavior is the only authority, label it characterization and question suspected defects.
For feature and bug changes, use `test-first` for meaningful failure and passing evidence when execution is available.
Existing-behavior baselines can pass immediately. Do not manufacture a failure or weaken an assertion to claim success.

Inspect for these failure modes:

- Assertions merely repeat inputs, constants, file inventories, or the algorithm that produced the actual value.
- The expected result comes from the same implementation being checked, including unreviewed snapshots.
- Mocks or fixtures supply the behavior that the application was supposed to perform.
- A negative case fails at an earlier guard, so it never reaches the rule named by the test.
- Private call shapes, source spellings, or setup details fail after a change that preserves the contract.
- Repeated cases protect the same failure without adding a distinct boundary or lifecycle risk.
- A check passes without observing an outcome, such as optional assertions, swallowed failures, or no collected cases.
- The name or claimed coverage exceeds the input, execution path, or assertions actually exercised.

Investigate these signals in existing tests; do not automatically delete tests. Before accepting new tests,
resolve the problem or identify the independent contract.
Static checks, exact bytes, call order, snapshots, exports, and inventories can be the contract for protocols,
configuration, compatibility, security, packaging, generated artifacts, or migrations. Judge their actual failure
mode and consumer. Preserve useful contracts even when the cheapest independent check inspects source.
Slowness, age, count, or resemblance to implementation alone does not justify removal.

## Keep evidence trustworthy

Keep tested application behavior real. Substitute only dependencies outside the claimed boundary and
state evidence limits.
A mocked service response does not prove that service's integration.
Use isolated synthetic data, controlled nondeterminism, bounded synchronization, and cleanup after failures.
Do not add retries or broad tolerances to conceal flaky assertions. Report initial failures and retry results.

When a correct test fails, investigate the product, fixture, and environment separately. Do not delete the test,
skip its assertions, or approve a new snapshot merely to obtain a passing run.
Use `verify` for source-linked execution evidence. Distinguish generated tests, inspected code, and checks actually run.
Keep missing infrastructure, approved exclusions, and uncovered behavior separate from passing results.

Use `test-audit` for explicit suite assessment or cleanup. Keep feature reviews within requested scope;
test-quality observations do not authorize repository-wide audits.
