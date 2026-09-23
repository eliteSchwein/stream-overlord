import BaseApi from "../../abstracts/BaseApi";
import {saveCategoryEntry} from "../../helper/CategoryLibraryHelper";

export default class CategoryLibrarySaveApi extends BaseApi {
    restEndpoint = "category-library/save";
    restPost = true;
    websocketMethod = "category_library_save";
    async handle(data: any) {
        try { return {category: saveCategoryEntry(data?.category ?? data)}; }
        catch (error: any) { return {error: error?.message ?? "failed to save category"}; }
    }
}
