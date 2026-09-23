import BaseApi from "../../abstracts/BaseApi";
import {getCategoryEntry} from "../../helper/CategoryLibraryHelper";

export default class CategoryLibraryGetApi extends BaseApi {
    restEndpoint = "category-library/get";
    restPost = true;
    websocketMethod = "category_library_get";
    async handle(data: any) {
        const category = getCategoryEntry(data?.category_id ?? data?.categoryId);
        return category ? {category} : {error: "category not found"};
    }
}
