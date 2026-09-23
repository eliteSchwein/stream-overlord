import BaseApi from "../../abstracts/BaseApi";
import {activateCategory} from "../../helper/CategoryLibraryHelper";

export default class CategoryLibraryActivateApi extends BaseApi {
    restEndpoint = "category-library/activate";
    restPost = true;
    websocketMethod = "category_library_activate";
    async handle(data: any) {
        try { return {category: await activateCategory(data?.category_id ?? data?.categoryId)}; }
        catch (error: any) { return {error: error?.message ?? "failed to activate category"}; }
    }
}
