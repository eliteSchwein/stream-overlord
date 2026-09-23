import BaseApi from "../../abstracts/BaseApi";
import {importCategoryLibraryFromWebsite} from "../../helper/CategoryLibraryHelper";

export default class CategoryLibraryImportWebsiteApi extends BaseApi {
    restEndpoint = "category-library/import-website";
    restPost = true;
    websocketMethod = "category_library_import_website";

    async handle(data: any) {
        try {
            return await importCategoryLibraryFromWebsite(data ?? {});
        } catch (error: any) {
            return {error: error?.message ?? "failed to import category library from website"};
        }
    }
}
