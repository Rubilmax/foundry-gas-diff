import Zip from "adm-zip";
import * as fs from "fs";
import { dirname, resolve } from "path";

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

import { formatMarkdownDiff, formatShellDiff } from "./format";
import { loadReports, computeDiffs } from "./report";

const workflowId = core.getInput("workflowId");
const token = process.env.GITHUB_TOKEN || core.getInput("token");
const report = core.getInput("report");
const ignore = core.getInput("ignore").split(",");
const match = (core.getInput("match") || undefined)?.split(",");
const title = core.getInput("title");

const baseBranch: string = context.payload.pull_request?.base.ref || context.ref;
const baseBranchEscaped = baseBranch.replace(/[/\\]/g, "-");
const refReport = `${baseBranchEscaped}.${report}`;

const octokit = getOctokit(token);
const artifactClient = artifact.create();
const localReportPath = resolve(report);

let srcContent: string;

async function run() {
  try {
    const headBranch: string = context.payload.pull_request?.head.ref || context.ref;
    const headBranchEscaped = headBranch.replace(/[/\\]/g, "-");
    const outReport = `${headBranchEscaped}.${report}`;

    core.startGroup(`Upload new report from "${localReportPath}" as artifact named "${outReport}"`);
    const uploadResponse = await artifactClient.uploadArtifact(
      outReport,
      [localReportPath],
      dirname(localReportPath),
      {
        continueOnError: false,
      }
    );

    if (uploadResponse.failedItems.length > 0) throw Error("Failed to upload gas report.");

    core.info(`Artifact ${uploadResponse.artifactName} has been successfully uploaded!`);
  } catch (error: any) {
    return core.setFailed(error.message);
  }
  core.endGroup();

  // cannot use artifactClient because downloads are limited to uploads in the same workflow run
  // cf. https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts#downloading-or-deleting-artifacts
  let artifactId: number | null = null;
  if (context.eventName === "pull_request") {
    const { owner, repo } = context.repo;

    try {
      core.startGroup(
        `Searching artifact "${refReport}" of workflow with ID "${workflowId}" on repository "${owner}/${repo}" on branch "${baseBranch}"`
      );
      // Note that the runs are returned in most recent first order.
      for await (const runs of octokit.paginate.iterator(octokit.rest.actions.listWorkflowRuns, {
        owner,
        repo,
        workflow_id: workflowId,
        branch: baseBranch,
        status: "completed",
      })) {
        for (const run of runs.data) {
          await new Promise((resolve) => setTimeout(resolve, 200)); // avoid reaching GitHub API rate limit

          const res = await octokit.rest.actions.listWorkflowRunArtifacts({
            owner,
            repo,
            run_id: run.id,
          });

          const artifact = res.data.artifacts.find((artifact) => artifact.name === refReport);
          if (!artifact) continue;

          artifactId = artifact.id;
          core.info(
            `Found artifact named "${refReport}" with ID "${artifactId}" in run with ID "${run.id}"`
          );
          break;
        }
      }
      core.endGroup();

      if (artifactId) {
        core.startGroup(
          `Downloading artifact "${refReport}" of repository "${owner}/${repo}" with ID "${artifactId}"`
        );
        const res = await octokit.rest.actions.downloadArtifact({
          owner,
          repo,
          artifact_id: artifactId,
          archive_format: "zip",
        });

        // @ts-ignore data is unknown
        const zip = new Zip(Buffer.from(res.data));
        for (const entry of zip.getEntries()) {
          core.info(`Loading gas reports from "${entry.entryName}"`);
          srcContent = zip.readAsText(entry);
        }
        core.endGroup();
      } else core.error(`No workflow run found with an artifact named "${refReport}"`);
    } catch (error: any) {
      return core.setFailed(error.message);
    }
  }

  try {
    core.startGroup("Load gas reports");
    core.info(`Loading gas reports from "${localReportPath}"`);
    const compareContent = fs.readFileSync(localReportPath, "utf8");
    srcContent ??= compareContent; // if no source gas reports were loaded, defaults to the current gas reports

    const loadOptions = { ignorePatterns: ignore, matchPatterns: match };
    core.info(`Mapping reference gas reports`);
    const sourceReports = loadReports(srcContent, loadOptions);
    core.info(`Mapping compared gas reports`);
    const compareReports = loadReports(compareContent, loadOptions);
    core.endGroup();

    core.startGroup("Compute gas diff");
    const diffRows = computeDiffs(sourceReports, compareReports);
    core.info(`Format markdown of ${diffRows.length} diffs`);
    const markdown = formatMarkdownDiff(title, diffRows);
    core.info(`Format shell of ${diffRows.length} diffs`);
    const shell = formatShellDiff(diffRows);
    core.endGroup();

    console.log(shell);

    core.setOutput("shell", shell);
    core.setOutput("markdown", markdown);
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
