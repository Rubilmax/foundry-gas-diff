import Zip from "adm-zip";
import * as fs from "fs";
import { dirname, resolve } from "path";

import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

import { formatMarkdownDiff, formatShellDiff } from "./format";
import { loadReports, computeDiffs } from "./report";
import { isSortCriteriaValid, isSortOrdersValid } from "./types";

const token = process.env.GITHUB_TOKEN || core.getInput("token");
const report = core.getInput("report");
const ignore = core.getInput("ignore").split(",");
const match = (core.getInput("match") || undefined)?.split(",");
const header = core.getInput("header");
const sortCriteria = core.getInput("sortCriteria").split(",");
const sortOrders = core.getInput("sortOrders").split(",");
const baseBranch = core.getInput("base");
const headBranch = core.getInput("head");

const baseBranchEscaped = baseBranch.replace(/[/\\]/g, "-");
const baseReport = `${baseBranchEscaped}.${report}`;

const octokit = getOctokit(token);
const artifactClient = artifact.create();
const localReportPath = resolve(report);

const { owner, repo } = context.repo;
const repository = owner + "/" + repo;

let srcContent: string;
let refCommitHash: string | undefined;

async function run() {
  if (!isSortCriteriaValid(sortCriteria)) return;
  if (!isSortOrdersValid(sortOrders)) return;

  try {
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
    try {
      core.startGroup(
        `Searching artifact "${baseReport}" on repository "${repository}", on branch "${baseBranch}"`
      );
      // Note that the artifacts are returned in most recent first order.
      for await (const res of octokit.paginate.iterator(octokit.rest.actions.listArtifactsForRepo, {
        owner,
        repo,
      })) {
        await new Promise((resolve) => setTimeout(resolve, 200)); // avoid reaching GitHub API rate limit

        const artifact = res.data.find(
          (artifact) => !artifact.expired && artifact.name === baseReport
        );
        if (!artifact) continue;

        artifactId = artifact.id;
        refCommitHash = artifact.workflow_run?.head_sha;
        core.info(
          `Found artifact named "${baseReport}" with ID "${artifactId}" from commit "${refCommitHash}"`
        );
        break;
      }
      core.endGroup();

      if (artifactId) {
        core.startGroup(
          `Downloading artifact "${baseReport}" of repository "${repository}" with ID "${artifactId}"`
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
      } else core.error(`No workflow run found with an artifact named "${baseReport}"`);
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
    const diffRows = computeDiffs(sourceReports, compareReports, sortCriteria, sortOrders);
    core.info(`Format markdown of ${diffRows.length} diffs`);
    const markdown = formatMarkdownDiff(header, diffRows, repository, context.sha, refCommitHash);
    core.info(`Format shell of ${diffRows.length} diffs`);
    const shell = formatShellDiff(diffRows);
    core.endGroup();

    console.log(shell);

    if (diffRows.length > 0) {
      core.setOutput("shell", shell);
      core.setOutput("markdown", markdown);
    }
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
