# Verification scope

Use this reference before planning, generating, executing, or assessing verification.
Primary agents and specialists apply it within their assigned scope and permissions.
Explicit verification limits take precedence over this workflow's default verification procedures.
They do not expand edit, delegation, or shipping authority.

## Establish the boundary

Read user and applicable project instructions and current approved decisions.
Honor task or project limits, including exclusions of all agent verification or selected work.
Distinguish capability discovery, test generation, check execution, and infrastructure changes.
Skipping execution alone does not exclude requested test generation. Excluding infrastructure work does not exclude
existing checks. Do not broaden a narrow exclusion.

Record the boundary and source with task constraints: permitted checks, exclusions, continuation conditions for
impractical or unavailable checks, and any supplied reason. Carry them into assignments, reviews,
and authorized handoffs.
Reuse them after agent switches or resumes without reconfirming applicable instructions or approvals.
Revisit affected decisions only for changed requirements or material ambiguity in applying the boundary.

Without an explicit limit, use proportionate verification under the existing procedures.
Repository size, complexity, missing access, and anticipated cost do not create an automatic exclusion.
For consequential gaps, propose a bounded correction or explicit accepted limitation for the user's decision.
Do not ask every task to choose a verification policy.

## Apply the boundary

- Assess capabilities only within the agreed discovery scope. Do not investigate excluded environments or coverage.
- Generate tests and run checks only within their respective scope. Do not install tools, create a harness, or
  repair infrastructure solely to satisfy excluded verification.
- Apply approved continuation conditions for impractical or unavailable checks without asking again.
  State the limitation and continue remaining work. Do not repeatedly retry or investigate excluded prerequisites.
- Accepted verification limits do not block requested implementation or handoff. Do not reopen them as planning
  prerequisites, repair attempts, or project-learning recommendations solely for absent verification.
  Continue required work outside the exclusion.
- Preserve required code and security reviews, known defects, consequential product questions, and permission limits.
  An exclusion does not resolve those issues. Do not weaken assertions or change acceptance criteria to hide a failure.
- Assess merge readiness separately. Agent verification exclusions do not satisfy or disable required CI,
  branch protections, or other external merge requirements.

## Report evidence and limits

Use `SKIP` for unrun checks excluded by user or applicable project instructions. State scope, decision source, and
unverified behavior. A concise scope-level entry suffices; do not invent commands, counts, or
excluded discovery inventories.
Use `BLOCKED` when a check remains required and cannot run. A later exclusion can remove its task prerequisite,
but preserve any earlier attempt and result. A check that ran and found a failure remains `FAIL`.

Report accepted limitations without reopening approval or requiring follow-up.
Report completion against the assigned scope separately from check results and merge readiness.
Never count an exclusion as `PASS`, claim full verification, or claim an unmeasured performance improvement.
