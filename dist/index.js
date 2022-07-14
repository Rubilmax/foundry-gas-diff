/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

var __createBinding = (undefined && undefined.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (undefined && undefined.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (undefined && undefined.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const check_1 = require("./check");
const format_1 = require("./format");
const report_1 = require("./report");
const artifact = __importStar(require("@actions/artifact"));
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
const path_1 = require("path");
const token = process.env.GITHUB_TOKEN || core.getInput("token");
if (!token)
    throw Error("A GitHub token must be defined.");
const report = core.getInput("report");
const outReport = core.getInput("outReport");
const refReport = core.getInput("refReport");
const octokit = (0, github_1.getOctokit)(token);
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const isPullRequest = !!github_1.context.payload.pull_request;
        const finish = isPullRequest
            ? yield (0, check_1.createCheck)(octokit, github_1.context)
            : (details) => console.log(details);
        const artifactClient = artifact.create();
        core.startGroup("Upload new report");
        const localReportPath = (0, path_1.resolve)(report);
        try {
            const uploadResponse = yield artifactClient.uploadArtifact(outReport, [localReportPath], (0, path_1.dirname)(localReportPath), {
                continueOnError: false,
            });
            if (uploadResponse.failedItems.length > 0)
                throw Error("Failed to upload gas report.");
            core.info(`Artifact ${uploadResponse.artifactName} has been successfully uploaded!`);
        }
        catch (error) {
            core.setFailed(error.message);
            yield finish({
                conclusion: "failure",
                output: {
                    title: "Gas diff failed",
                    summary: `Could not upload latest gas report: ${error.message}`,
                },
            });
            return;
        }
        core.endGroup();
        let downloadResponse = undefined;
        try {
            core.startGroup("Download reference report");
            downloadResponse = yield artifactClient.downloadArtifact(refReport, undefined, {
                createArtifactFolder: false,
            });
            core.info(`Artifact ${downloadResponse.artifactName} was downloaded to ${downloadResponse.downloadPath}`);
            core.endGroup();
        }
        catch (error) {
            core.error(error.message);
            yield finish({
                conclusion: "neutral",
                output: {
                    title: "Gas diff incomplete",
                    summary: `Could not download reference gas report: ${error.message}`,
                },
            });
        }
        try {
            core.startGroup("Load gas reports");
            const sourceReports = (0, report_1.loadReports)((downloadResponse === null || downloadResponse === void 0 ? void 0 : downloadResponse.downloadPath) || localReportPath);
            const compareReports = (0, report_1.loadReports)(localReportPath);
            core.endGroup();
            core.startGroup("Compute gas diff");
            const diffRows = (0, report_1.computeDiff)(sourceReports, compareReports);
            const text = (0, format_1.formatDiffMarkdown)(diffRows);
            core.endGroup();
            yield finish({
                //   details_url: url,
                conclusion: "success",
                output: {
                    title: `Gas diff successful`,
                    summary: `${diffRows.length} differences found`,
                    text,
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

