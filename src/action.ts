import { createCheck } from "./check";
import { formatDiffMarkdown } from "./format";
import { loadReports, computeDiff } from "./report";
import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { dirname, resolve } from "path";

const token = process.env.GITHUB_TOKEN || core.getInput("token");
if (!token) throw Error("A GitHub token must be defined.");

const report = core.getInput("report");
const outReport = core.getInput("outReport");
const refReport = core.getInput("refReport");

const octokit = getOctokit(token);

async function run() {
  const isPullRequest = !!context.payload.pull_request;

  const finish = isPullRequest
    ? await createCheck(octokit, context)
    : (details: Object) => console.log(details);

  const artifactClient = artifact.create();

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
    core.setFailed(error.message);

    await finish({
      conclusion: "failure",
      output: {
        title: "Gas diff failed",
        summary: `Error: ${error.message}`,
      },
    });

    return;
  }
  core.endGroup();

  try {
    core.startGroup("Download reference report");
    const downloadResponse = await artifactClient.downloadArtifact(refReport, undefined, {
      createArtifactFolder: false,
    });

    core.info(
      `Artifact ${downloadResponse.artifactName} was downloaded to ${downloadResponse.downloadPath}`
    );
    core.endGroup();

    core.startGroup("Load reports");
    const sourceReports = loadReports(downloadResponse.downloadPath);
    const compareReports = loadReports(localReportPath);
    core.endGroup();

    core.startGroup("Compute gas diff");
    const diffRows = computeDiff(sourceReports, compareReports);
    const summary = formatDiffMarkdown(diffRows);
    core.endGroup();

    await finish({
      //   details_url: url,
      conclusion: "success",
      output: {
        title: `Gas diff successful`,
        summary,
      },
    });
  } catch (error: any) {
    core.setFailed(error.message);

    await finish({
      conclusion: "failure",
      output: {
        title: "Gas diff failed",
        summary: `Error: ${error.message}`,
      },
    });
  }
}

run();
