<template>
  <FileManagerPage
    :title="$t('assets.title')"
    route-base="assets"
    route-param="assetPath"
    list-method="assets_list"
    delete-method="assets_delete"
    move-method="assets_move"
    create-folder-method="assets_create_folder"
    compress-method="assets_compress"
    upload-endpoint="assets/upload"
    :can-compress="true"
    :upload-label="$t('assets.upload')"
    :drop-label="$t('file.dropFiles')"
    upload-icon="mdi-upload"
    :search-label="$t('assets.search')"
    :empty-label="$t('assets.noAssetsFound')"
    :create-folder-label="$t('assets.createFolder')"
    :folder-label="$t('file.folder')"
    :folder-up-label="$t('file.folderUp')"
    :no-folders-label="$t('file.noFoldersFound')"
    :move-dialog-title="$t('assets.moveDialog')"
    :copy-dialog-title="$t('assets.copyDialog')"
    :preview-label="$t('assets.preview')"
    :delete-confirm-title="$t('assets.deleteConfirmTitle')"
    :delete-confirm-text="$t('assets.deleteConfirmText')"
    :target-label="$t('common.target') + ' ' + $t('file.name')"
    :target-folder-label="$t('common.target') + ' ' + $t('file.folder')"
    :normal-url-label="$t('assets.normalUrl')"
    :compressed-url-label="$t('assets.compressedUrl')"
    :compress-label="$t('assets.compress')"
    :move-label="$t('assets.move')"
    :delete-label="$t('assets.delete')"
    :cancel-label="$t('common.cancel')"
    :open-label="$t('assets.open')"
    :hide-overlay-used="true"
    :hide-music-used="true"
  />
</template>

<script lang="ts">
import FileManagerPage from '@/components/files/FileManagerPage.vue'

export default {
  components: {
    FileManagerPage,
  },
}
</script>
