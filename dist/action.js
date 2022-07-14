var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createCheck } from "./check";
import { formatDiffMarkdown } from "./format";
import { loadReports, computeDiff } from "./report";
import * as artifact from "@actions/artifact";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { dirname, resolve } from "path";
const token = process.env.GITHUB_TOKEN || core.getInput("token");
if (!token)
    throw Error("A GitHub token must be defined.");
const report = core.getInput("report");
const outReport = core.getInput("outReport");
const refReport = core.getInput("refReport");
const octokit = getOctokit(token);
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const isPullRequest = !!context.payload.pull_request;
        const finish = isPullRequest
            ? yield createCheck(octokit, context)
            : (details) => console.log(details);
        try {
            core.startGroup("Download reference report");
            const artifactClient = artifact.create();
            core.info(`Starting download for ${refReport}`);
            const downloadResponse = yield artifactClient.downloadArtifact(refReport, resolve(""), {
                createArtifactFolder: false,
            });
            core.info(`Artifact ${downloadResponse.artifactName} was downloaded to ${downloadResponse.downloadPath}`);
            core.info("Artifact download has finished successfully");
            core.endGroup();
            core.startGroup("Upload new report");
            const localReportPath = resolve(report);
            const uploadResponse = yield artifactClient.uploadArtifact(outReport, [localReportPath], dirname(localReportPath), {
                continueOnError: false,
            });
            if (uploadResponse.failedItems.length > 0) {
                core.setFailed(`An error was encountered when uploading ${uploadResponse.artifactName}. There were ${uploadResponse.failedItems.length} items that failed to upload.`);
            }
            else {
                core.info(`Artifact ${uploadResponse.artifactName} has been successfully uploaded!`);
            }
            core.endGroup();
            core.startGroup("Load reports");
            const sourceReports = loadReports(downloadResponse.downloadPath);
            const compareReports = loadReports(localReportPath);
            core.endGroup();
            core.startGroup("Compute gas diff");
            const diffRows = computeDiff(sourceReports, compareReports);
            const summary = formatDiffMarkdown(diffRows);
            core.endGroup();
            yield finish({
                //   details_url: url,
                conclusion: "success",
                output: {
                    title: `Gas diff successful`,
                    summary,
                },
            });
        }
        catch (error) {
            core.setFailed(error.message);
            yield finish({
                conclusion: "failure",
                output: {
                    title: "Gas diff failed",
                    summary: `Error: ${error.message}`,
                },
            });
        }
    });
}
run();
//# sourceMappingURL=action.js.map