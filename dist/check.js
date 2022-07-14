var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// create a check and return a function that updates (completes) it
export function createCheck(github, context) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const check = yield github.rest.checks.create(Object.assign(Object.assign({}, context.repo), { name: "Gas Diff", head_sha: (_a = context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.head.sha, status: "in_progress" }));
        return (details) => __awaiter(this, void 0, void 0, function* () {
            yield github.rest.checks.update(Object.assign(Object.assign(Object.assign({}, context.repo), { check_run_id: check.data.id, completed_at: new Date().toISOString(), status: "completed" }), details));
        });
    });
}
//# sourceMappingURL=check.js.map