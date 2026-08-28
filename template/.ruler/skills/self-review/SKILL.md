---
name: self-review
description: Review a completed repository change before handoff for correctness, scope, tests, documentation, architecture, security, and generated-artifact drift.
---

# Self-review

Review the actual diff against the request and its recorded acceptance criteria or selected change plan. Look first for correctness, data loss, boundary violations, unsafe defaults, missing negative tests, documentation drift, and stale generated files.

Run the manifest verification command. Report findings by severity with file evidence; fix in-scope issues when implementation was authorized. Do not claim success from green checks alone when behavior was not exercised.
