import BaseApi from "../../abstracts/BaseApi";
import {refreshCategory} from "../../helper/CategoryLibraryHelper";
import {getTwitchClient} from "../../App";

export default class CategoryLibraryRefreshApi extends BaseApi {
    restEndpoint = "category-library/refresh";
    restPost = true;
    websocketMethod = "category_library_refresh";
    async handle(data: any) {
        try {
            return {category: await refreshCategory(data?.category_id ?? data?.categoryId, getTwitchClient()?.getBot())};
        } catch (error: any) {
            return {error: error?.message ?? "failed to refresh category"};
        }
    }
}
