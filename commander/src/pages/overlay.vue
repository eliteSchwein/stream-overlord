<template>
  <FileManagerPage
    :title="$t('overlay.title')"
    route-base="overlay"
    route-param="overlayPath"
    list-method="overlay_list"
    delete-method="overlay_delete"
    move-method="overlay_move"
    create-folder-method="overlay_create_folder"
    create-file-method="overlay_edit"
    read-text-method="overlay_read"
    update-text-method="overlay_edit"
    upload-endpoint="overlay/upload"
    public-prefix=""
    accept=".html,.htm,.css,.js,.mjs,.cjs,.json,.svg,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.txt,.md"
    :enable-editor="true"
    :can-compress="false"
    :upload-label="$t('overlay.upload')"
    :drop-label="$t('file.dropFiles')"
    upload-icon="mdi-monitor-screenshot"
    :search-label="$t('overlay.search')"
    :empty-label="$t('overlay.noOverlayFound')"
    :create-folder-label="$t('overlay.createFolder')"
    :create-file-label="$t('overlay.createFile')"
    :file-name-label="$t('file.name')"
    :template-label="$t('overlay.template')"
    :content-label="$t('overlay.content')"
    :editor-label="$t('overlay.editor')"
    :save-label="$t('common.save')"
    :code-label="$t('overlay.code')"
    :width-label="$t('overlay.previewWidth')"
    :height-label="$t('overlay.previewHeight')"
    :preset-label="$t('overlay.previewPreset')"
    :preview-mode-label="$t('overlay.previewMode')"
    :template-warning-label="$t('overlay.templatePreviewWarning')"
    :folder-label="$t('file.folder')"
    :folder-up-label="$t('file.folderUp')"
    :no-folders-label="$t('file.noFoldersFound')"
    :move-dialog-title="$t('overlay.moveDialog')"
    :copy-dialog-title="$t('overlay.copyDialog')"
    :preview-label="$t('overlay.preview')"
    :delete-confirm-title="$t('overlay.deleteConfirmTitle')"
    :delete-confirm-text="$t('overlay.deleteConfirmText')"
    :target-label="$t('common.target') + ' ' + $t('file.name')"
    :target-folder-label="$t('common.target') + ' ' + $t('file.folder')"
    :normal-url-label="$t('overlay.url')"
    :compressed-url-label="$t('assets.compressedUrl')"
    :move-label="$t('overlay.move')"
    :delete-label="$t('overlay.delete')"
    :cancel-label="$t('common.cancel')"
    :open-label="$t('overlay.open')"
    :hide-assets-used="true"
    :hide-music-used="true"
    create-file-preset-folder="overlay"
    create-file-extension=".html"
    :create-file-enforce-extension="true"
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
