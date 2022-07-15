import Zip from "adm-zip";
import * as fs from "fs";
import { dirname, resolve } from "path";

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

import { formatDiffMarkdown, formatDiffShell } from "./format";
import { loadReports, computeDiff } from "./report";

const workflowId = core.getInput("workflowId");
const token = process.env.GITHUB_TOKEN || core.getInput("token");
const report = core.getInput("report");
const outReport = core.getInput("outReport").replace(/[\/\\]/g, "-");
const refReport = core.getInput("refReport").replace(/[\/\\]/g, "-");

const octokit = getOctokit(token);
const artifactClient = artifact.create();

let srcContent: string;

async function run() {
  core.startGroup("Upload new report");
  const localReportPath = resolve(report);
  try {
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
    const branch = context.payload.pull_request!.base.ref;

    try {
      core.startGroup(
        `Searching artifact "${refReport}" of workflow with ID "${workflowId}" on repository "${owner}/${repo}" on branch "${branch}"`
      );
      // Note that the runs are returned in most recent first order.
      for await (const runs of octokit.paginate.iterator(octokit.rest.actions.listWorkflowRuns, {
        owner,
        repo,
        workflow_id: workflowId,
        branch,
        status: "completed",
      })) {
        for (const run of runs.data) {
          await new Promise((resolve) => setTimeout(resolve, 200)); // avoid reaching GitHub API rate limit

          const res = await octokit.rest.actions.listWorkflowRunArtifacts({
            owner: owner,
            repo: repo,
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
          owner: owner,
          repo: repo,
          artifact_id: artifactId,
          archive_format: "zip",
        });

        // @ts-ignore data is unknown
        const zip = new Zip(Buffer.from(res.data));
        zip.getEntries().forEach(function (zipEntry) {
          console.log(zipEntry.toString());
          srcContent = zip.readAsText(zipEntry);
        });
        core.endGroup();
      } else core.error(`No workflow run found with an artifact named "${refReport}"`);
    } catch (error: any) {
      return core.setFailed(error.message);
    }
  }

  try {
    core.startGroup("Load gas reports");
    const compareContent = fs.readFileSync(localReportPath, "utf8");
    srcContent ??= compareContent; // if no source gas reports were loaded, defaults to the current gas reports

    const sourceReports = loadReports(srcContent);
    const compareReports = loadReports(compareContent);
    core.endGroup();

    core.startGroup("Compute gas diff");
    const diffRows = computeDiff(sourceReports, compareReports);
    const markdown = formatDiffMarkdown(diffRows);
    const shell = formatDiffShell(diffRows);
    core.endGroup();

    console.log(shell);

    core.setOutput("shell", shell);
    core.setOutput("markdown", markdown);
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
