---
name: extract-rules-from-rfc-chapter
description: Extract all RFC rules from a specific chapter of an RFC document. Use this skill when asked to "extract rules from chapter", "implement all rules from RFC section", "generate rules from RFC chapter", or "process all requirements in RFC chapter X".
---

# Extract Rules from RFC Chapter Skill

This skill extracts all RFC 2119 normative statements from a specific chapter of an RFC document and generates individual rules for each statement by calling the `generate-rfc-rule` skill. After generation, it performs a comprehensive review of all generated rules.

## Purpose

Automates the bulk extraction and generation of RFC rules from a chapter, ensuring:

- All RFC 2119 keywords are identified and processed
- Each normative statement becomes a separate rule
- All generated rules undergo validation before completion
- User is consulted when clarification is needed

## RFC 2119 Keywords

The skill identifies these RFC 2119 requirement level keywords:

| Keyword                     | Severity | Description           |
| --------------------------- | -------- | --------------------- |
| MUST, REQUIRED, SHALL       | error    | Absolute requirement  |
| MUST NOT, SHALL NOT         | error    | Absolute prohibition  |
| SHOULD, RECOMMENDED         | warn     | Strong recommendation |
| SHOULD NOT, NOT RECOMMENDED | warn     | Strong discouragement |
| MAY, OPTIONAL               | hint     | Truly optional        |

**Note**: Keywords MUST appear in UPPERCASE to be normative (per RFC 2119).

## Required Inputs

1. **RFC document path**: Local file path to the RFC document (text or HTML format)
2. **Chapter number**: The chapter/section number to process (e.g., "9.3.1" or "9")
3. **Target RFC package**: The package where rules should be generated (e.g., `rfc-9110-rules`)

## Process Overview

```
┌─────────────────────────────────┐
│ 1. Parse RFC Chapter            │
│    - Load RFC document          │
│    - Extract target chapter     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 2. Identify RFC 2119 Keywords   │
│    - Scan for UPPERCASE keywords│
│    - Extract context for each   │
│    - Handle multi-keyword cases │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 3. Generate Rules               │
│    - Call generate-rfc-rule     │
│    - One rule per keyword       │
│    - Track all generated rules  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 4. Review & Validate            │
│    - Check all generated rules  │
│    - Verify validation checklist│
│    - Ask user if unclear        │
└─────────────────────────────────┘
```

## Steps

### 1. Load and Parse RFC Document

**Read the RFC document:**

```typescript
// Read from local file path
const rfcContent = readFile(rfcDocumentPath);
```

**Extract the target chapter:**

- Parse the RFC structure to identify section boundaries
- Handle both RFC text format and HTML format
- Extract the full text of the specified chapter including subsections
- Preserve paragraph structure and context

**Tips:**

- For text format: Look for section headers like "9.3.1. Section Title"
- For HTML format: Use section anchors and heading tags
- Include the chapter title and number in the extracted content
- Capture all text until the next section at the same or higher level

### 2. Identify RFC 2119 Keywords

**Scan for normative keywords:**

- Search for all RFC 2119 keywords in UPPERCASE
- Keywords: MUST, MUST NOT, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, OPTIONAL, REQUIRED
- Only match UPPERCASE occurrences (lowercase is not normative per RFC 2119)

**Extract context for each keyword:**

- Capture the full sentence containing the keyword
- Include preceding sentence for context if needed
- Include following sentence if the requirement spans multiple sentences
- Preserve paragraph boundaries

**Handle multi-keyword statements:**

- If a single sentence contains multiple RFC 2119 keywords, treat each keyword as a separate rule
- Example: "Clients MUST send header X and SHOULD include header Y" → 2 rules

**Example extraction:**

```
Found in Section 9.3.1:
- Keyword: SHOULD NOT
  Context: "A client SHOULD NOT generate content in a DELETE request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported."

- Keyword: MUST
  Context: "If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method."
```

### 3. Analyze Content Density and Determine Folder Structure

**Before generating rules, analyze the section structure to make smart folder decisions:**

1. **Map all subsections with rule counts:**
   - Identify all subsections within the target chapter
   - Count RFC 2119 keywords in each subsection
   - Note which subsections are informational vs normative

2. **Apply smart folder logic:**

   **Create subfolders when:**
   - A subsection contains **5+ rules** → Create dedicated subfolder
   - Multiple subsections each have **3+ rules** → Create subfolders for each
   - Clear logical grouping with substantial content → Create subfolder

   **Keep rules in parent folder when:**
   - Section has 4 subsections but only 2 contain 1-2 rules each → Keep all in parent folder
   - Subsections have minimal content (1-2 rules each) → Keep in parent folder
   - Creating subfolders would result in mostly empty directories → Keep in parent folder

3. **Document the decision:**

   ```
   Section 12.4 Content Negotiation
     12.4.1 Proactive Negotiation: 2 rules
     12.4.2 Reactive Negotiation: 0 rules
     12.4.3 Request Content Negotiation: 1 rule
     12.4.4 Content Negotiation Field Definitions: 0 rules

   Decision: Keep all rules in content-negotiation/ folder (sparse content across subsections)
   ```

4. **When unclear, ask the user:**

   ```
   Folder Structure Decision Needed:

   Section 12.4 has 4 subsections:
   - 12.4.1: 2 rules
   - 12.4.2: 0 rules
   - 12.4.3: 1 rule
   - 12.4.4: 0 rules

   Options:
   1. Keep all 3 rules in content-negotiation/ folder (recommended for sparse content)
   2. Create subfolders 12.4.1/ and 12.4.3/ (may result in empty structure)

   Which approach would you prefer?
   ```

### 4. Generate Rules for Each Keyword

**For each identified RFC 2119 keyword occurrence:**

1. **Prepare context for generate-rfc-rule skill:**
   - RFC text excerpt (full context around keyword)
   - RFC number (extracted from document)
   - Chapter/section number and title
   - Target package name
   - RFC URL for the specific section
   - **Folder structure decision from step 3**

2. **Call generate-rfc-rule skill:**

   ```
   Use skill: generate-rfc-rule
   Input:
   - RFC excerpt: [extracted context]
   - RFC number: [e.g., 9110]
   - Section: [e.g., 9.3.1 - DELETE]
   - Target package: [e.g., rfc-9110-rules]
   - Target directory: [based on content density analysis]
   ```

3. **Track generated rules:**
   - Maintain a list of all generated rule file paths
   - Track rule IDs and names
   - Note any issues during generation

**Example:**

```
Analyzing section structure...
Section 12.4 Content Negotiation:
  12.4.1: 2 rules
  12.4.2: 0 rules
  12.4.3: 1 rule
  12.4.4: 0 rules

Decision: Keeping all rules in content-negotiation/ (sparse content)

Generating rules from Chapter 12.4 (Content Negotiation):
[1/3] Generating rule for SHOULD: server-should-send-vary-header
      → packages/rfc-9110-rules/src/rules/content-negotiation/
[2/3] Generating rule for MUST: origin-server-must-generate-vary-header
      → packages/rfc-9110-rules/src/rules/content-negotiation/
[3/3] Generating rule for MAY: server-may-use-proactive-negotiation
      → packages/rfc-9110-rules/src/rules/content-negotiation/
```

### 5. Review and Validate All Generated Rules

After all rules are generated, perform a comprehensive review:

#### 5.1. Load All Generated Rules

Read each generated rule file and parse its structure.

#### 5.2. Validation Checklist

For each rule, verify:

**Naming Convention:**

- [ ] Follows kebab-case pattern: `{actor}-{keyword}-{constraint}-{condition}.rule.ts`
- [ ] Actor is appropriate (client, server, origin-server, proxy, cache, user-agent)
- [ ] Keyword matches RFC 2119 term (must, should, may, etc.)
- [ ] Name is descriptive and concise
- [ ] Ends with `.rule.ts`

**File Location:**

- [ ] Placed in appropriate directory based on RFC section structure
- [ ] Directory structure follows existing conventions in the package
- [ ] Parent directories exist

**Rule Metadata:**

- [ ] Rule ID format: `rfc{number}/{rule-name}`
- [ ] Severity correctly maps RFC keyword:
  - MUST/MUST NOT → `error`
  - SHOULD/SHOULD NOT → `warn`
  - MAY → `hint`
- [ ] Type is set appropriately (`static`, `analytics`, `informational`)
- [ ] Actor specified with `.appliesTo()`

**Documentation:**

- [ ] RFC URL is correct and points to the right section
- [ ] Description contains relevant RFC text (exact or paraphrased)
- [ ] Summary added if description is long (>2-3 sentences)
- [ ] Context is sufficient to understand the requirement

**Validation Logic:**

- [ ] `.rule()` method implemented (unless informational)
- [ ] Uses appropriate matchers from `@thymian/core`
- [ ] Condition matcher reflects when rule applies
- [ ] Constraint matcher reflects what should be flagged
- [ ] Logic correctly implements the RFC requirement
- [ ] Or `.done()` called without `.rule()` for informational rules

**Code Quality:**

- [ ] Imports are correct (`@thymian/core`, `@thymian/http-linter`)
- [ ] Rule exported as default
- [ ] Rule ends with `.done()`
- [ ] No syntax errors

**Consistency:**

- [ ] Similar rules follow similar patterns
- [ ] Naming is consistent with other rules in the package
- [ ] Directory placement is consistent

#### 5.3. Cross-Rule Validation

**Check for duplicates:**

- Are there multiple rules for the same requirement?
- Do any rules overlap in what they validate?

**Check for completeness:**

- Does each RFC 2119 keyword occurrence have a corresponding rule?
- Are any requirements split across multiple rules that should be combined?

**Check for coherence:**

- Do rules in the same section follow a consistent pattern?
- Are related rules organized together?

#### 5.4. User Consultation

**Ask user for clarification when:**

1. **Ambiguous requirements:**
   - Actor is unclear from RFC text
   - Condition is complex or multi-faceted
   - Constraint involves interpretation
   - Example: "Is this rule for clients, servers, or both?"

2. **Validation logic uncertainty:**
   - How to implement the constraint check
   - What matchers are appropriate
   - Whether rule should be static or analytics
   - Example: "This rule says 'SHOULD retry after delay'. Should this be static (check for retry logic) or analytics (observe retry behavior)?"

3. **Naming or organization issues:**
   - Multiple valid naming options
   - Unclear where to place the rule
   - Similar existing rules with different patterns
   - Example: "Found similar rule 'client-must-not-send-x'. Should we use same naming pattern or differentiate?"

4. **Validation findings:**
   - Rules that don't pass validation checklist
   - Inconsistencies between generated rules
   - Missing validation logic
   - Example: "Rule X has no validation logic. RFC text is vague. Should this be informational?"

5. **Scope decisions:**
   - Whether to split or combine rules
   - How to handle multi-keyword statements
   - Overlapping requirements
   - Example: "This paragraph has 3 MUST statements about the same header. Generate 3 rules or 1 combined rule?"

**Format for user consultation:**

```
Review Finding: [Issue description]

Context: [RFC text or rule details]

Question: [Specific question for user]

Options:
1. [Option A]
2. [Option B]
3. [Option C - if applicable]

What would you like me to do?
```

#### 5.5. Generate Review Report

Create a summary report:

```markdown
## RFC Chapter Extraction Report

**Chapter**: [Section number and title]
**RFC**: RFC [number]
**Package**: [package name]

### Summary

- Total RFC 2119 keywords found: [count]
- Rules generated: [count]
- Rules passed validation: [count]
- Rules requiring attention: [count]

### Generated Rules

#### Passed Validation ✓

1. [rule-name] - [severity] - [file path]
2. ...

#### Requires Attention ⚠

1. [rule-name] - [issue description]
2. ...

### Validation Details

[Detailed findings for each rule that needs attention]

### Next Steps

[Any actions needed to complete the rule generation]
```

## Complete Example Workflow

**User Request:**

> Extract all rules from chapter 9.3.1 of RFC 9110

**Skill Execution:**

```
Step 1: Loading RFC 9110 from local file
✓ RFC document loaded successfully
✓ Chapter 9.3.1 (DELETE) extracted

Step 2: Identifying RFC 2119 keywords
✓ Found 3 normative statements:
  1. Line 45: SHOULD NOT - "A client SHOULD NOT generate content..."
  2. Line 52: MUST - "A server MUST send appropriate status code..."
  3. Line 58: MAY - "The server MAY process the request..."

Step 3: Analyzing content density for folder structure
✓ Section 9.3.1 has 3 subsections
  9.3.1: 3 rules identified
  (No further subsections)
✓ Decision: Keep all rules in methods/method-definitions/delete/ (single section)

Step 4: Generating rules (using generate-rfc-rule skill)
[1/3] Generating: client-should-not-generate-content-for-delete-request
      ✓ Created: packages/rfc-9110-rules/src/rules/methods/method-definitions/delete/client-should-not-generate-content-for-delete-request.rule.ts

[2/3] Generating: server-must-send-appropriate-status-code-for-delete
      ✓ Created: packages/rfc-9110-rules/src/rules/methods/method-definitions/delete/server-must-send-appropriate-status-code-for-delete.rule.ts

[3/3] Generating: server-may-process-delete-request-before-response
      ✓ Created: packages/rfc-9110-rules/src/rules/methods/method-definitions/delete/server-may-process-delete-request-before-response.rule.ts

Step 5: Reviewing and validating all generated rules

Validating rule 1/3: client-should-not-generate-content-for-delete-request
✓ Naming convention correct
✓ File location appropriate
✓ Severity correct (warn)
✓ Validation logic implemented
✓ All imports correct

Validating rule 2/3: server-must-send-appropriate-status-code-for-delete
⚠ Issue detected: Validation logic unclear

Review Finding: Ambiguous validation logic

Context: "A server MUST send an appropriate status code to indicate the result of DELETE."

Question: The RFC requires "appropriate status code" but doesn't specify which codes. How should we validate this?

Options:
1. Make it informational (no validation logic)
2. Check for common DELETE success codes (200, 202, 204)
3. Flag any error codes as potential issues

What would you like me to do?

[User provides answer]

Validating rule 3/3: server-may-process-delete-request-before-response
✓ All checks passed
⚠ Note: Rule is informational (no validation logic) - this is expected for MAY rules

--- Review Complete ---

Generated Rules Report:
✓ 3 rules generated
✓ 2 rules passed all validations
⚠ 1 rule required clarification (now resolved)

All rules are ready for use!
```

## Error Handling

**RFC document not found:**

- Verify file path is correct
- Check file permissions
- Ask user to provide correct path

**Chapter not found:**

- Verify chapter number format
- List available chapters for user
- Ask user to clarify chapter number

**No RFC 2119 keywords found:**

- Verify chapter contains normative language
- Check if chapter is informational only
- Ask user if they want to process a different chapter

**Rule generation fails:**

- Log the error and continue with remaining rules
- Report failed rules in review
- Ask user if they want to retry or skip

**Validation finds critical issues:**

- Pause and consult user before proceeding
- Don't finalize rules with critical issues
- Offer to fix automatically or let user fix manually

## Tips for Effective Extraction

1. **Start with small chapters**: Test on a short section before processing large chapters
2. **Review RFC structure first**: Understand how the RFC organizes its content
3. **Check existing rules**: Look for patterns in already-implemented rules
4. **Be conservative**: When in doubt, ask the user rather than making assumptions
5. **Batch similar questions**: If multiple rules have the same issue, ask once
6. **Document decisions**: Keep track of decisions made during review for consistency

## Notes

- **Multi-chapter processing**: To process multiple chapters, call this skill multiple times
- **Rule updates**: This skill creates new rules; use `generate-rfc-rule` directly for updates
- **Performance**: Large chapters may take time; set user expectations appropriately
- **Quality over speed**: Thorough validation is more important than fast generation
- **RFC format variations**: Different RFCs may format normative text differently; adapt parsing as needed
