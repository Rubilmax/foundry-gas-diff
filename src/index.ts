import { formatDiffMarkdown, formatDiffShell } from "./format";
import { loadReports, computeDiff } from "./report";
import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import AdmZip from "adm-zip";
import { dirname, join, resolve } from "path";

const token = process.env.GITHUB_TOKEN || core.getInput("token");
const report = core.getInput("report");
const outReport = core.getInput("outReport").replace(/\//g, "-");
const refReport = core.getInput("refReport").replace(/\//g, "-");

const octokit = getOctokit(token);

async function run() {
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
    return core.setFailed(error.message);
  }
  core.endGroup();

  // cannot use artifactClient because downloads are limited to uploads in the same workflow run
  // cf. https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts#downloading-or-deleting-artifacts
  core.startGroup("Download reference report");
  let artifactPath: string | undefined = undefined;
  try {
    let artifactId: number | null = null;
    const { owner, repo } = context.repo;

    core.startGroup(
      `Finding artifact "${refReport}" of workflow "${context.workflow}" on repository "${owner}/${repo}"`
    );
    // Note that the runs are returned in most recent first order.
    for await (const runs of octokit.paginate.iterator(octokit.rest.actions.listWorkflowRuns, {
      owner,
      repo,
      workflow_id: context.workflow,
    })) {
      for (const run of runs.data) {
        if (run.conclusion !== "success" && run.status !== "completed") continue;

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

    if (!artifactId) throw new Error("No matching workflow run found with any matching artifact");
    core.endGroup();

    const zip = await octokit.rest.actions.downloadArtifact({
      owner: owner,
      repo: repo,
      artifact_id: artifactId,
      archive_format: "zip",
    });

    const cwd = resolve();
    artifactPath = join(cwd, refReport);

    // @ts-ignore
    const adm = new AdmZip(Buffer.from(zip.data));

    core.startGroup(`==> Extracting: ${refReport}.zip`);

    adm.extractAllTo(resolve(), true);
    core.endGroup();

    core.info(`Artifact ${refReport} was downloaded to ${artifactPath}`);
  } catch (error: any) {
    core.error(error.message);
  }
  core.endGroup();

  try {
    core.startGroup("Load gas reports");
    const sourceReports = loadReports(artifactPath || localReportPath);
    const compareReports = loadReports(localReportPath);
    core.endGroup();

    core.startGroup("Compute gas diff");
    const diffRows = computeDiff(sourceReports, compareReports);
    const markdown = formatDiffMarkdown(diffRows);
    core.endGroup();

    core.setOutput("markdown", markdown);
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
