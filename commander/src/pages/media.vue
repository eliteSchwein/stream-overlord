<template>
  <FileManagerPage
    :title="$t('media.title')"
    route-base="media"
    route-param="mediaPath"
    list-method="media_list"
    delete-method="media_delete"
    move-method="media_move"
    create-folder-method="media_create_folder"
    compress-method="media_compress"
    upload-endpoint="assets/media/upload"
    :can-compress="true"
    :upload-label="$t('media.upload')"
    :drop-label="$t('file.dropFiles')"
    upload-icon="mdi-upload"
    :search-label="$t('media.search')"
    :empty-label="$t('media.noAssetsFound')"
    :create-folder-label="$t('media.createFolder')"
    :folder-label="$t('file.folder')"
    :folder-up-label="$t('file.folderUp')"
    :no-folders-label="$t('file.noFoldersFound')"
    :move-dialog-title="$t('media.moveDialog')"
    :copy-dialog-title="$t('media.copyDialog')"
    :preview-label="$t('media.preview')"
    :delete-confirm-title="$t('media.deleteConfirmTitle')"
    :delete-confirm-text="$t('media.deleteConfirmText')"
    :target-label="$t('common.target') + ' ' + $t('file.name')"
    :target-folder-label="$t('common.target') + ' ' + $t('file.folder')"
    :normal-url-label="$t('media.normalUrl')"
    :compressed-url-label="$t('media.compressedUrl')"
    :compress-label="$t('media.compress')"
    :move-label="$t('media.move')"
    :delete-label="$t('media.delete')"
    :cancel-label="$t('common.cancel')"
    :open-label="$t('media.open')"
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
