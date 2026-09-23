import BaseApi from "../../abstracts/BaseApi";
import {deleteCategoryEntry} from "../../helper/CategoryLibraryHelper";

export default class CategoryLibraryDeleteApi extends BaseApi {
    restEndpoint = "category-library/delete";
    restPost = true;
    websocketMethod = "category_library_delete";
    async handle(data: any) {
        try { return deleteCategoryEntry(data?.category_id ?? data?.categoryId); }
        catch (error: any) { return {error: error?.message ?? "failed to delete category"}; }
    }
}
