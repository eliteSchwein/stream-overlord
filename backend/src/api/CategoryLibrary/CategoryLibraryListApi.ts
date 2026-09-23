import BaseApi from "../../abstracts/BaseApi";
import {getCategoryLibrary} from "../../helper/CategoryLibraryHelper";

export default class CategoryLibraryListApi extends BaseApi {
    restEndpoint = "category-library/list";
    restPost = false;
    websocketMethod = "category_library_list";
    async handle() { return getCategoryLibrary(); }
}
