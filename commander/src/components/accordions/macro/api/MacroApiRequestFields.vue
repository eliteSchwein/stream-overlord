<template>
  <div>
    <v-row>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="task.data.url"
          variant="outlined"
          :label="$t('macro.api.url')"
          :placeholder="$t('macro.api.placeholders.url')"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          v-model="task.data.result_variable"
          variant="outlined"
          :label="$t('macro.api.resultVariable')"
          :placeholder="$t('macro.api.placeholders.resultVariable')"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <MacroApiKeyValueEditor
          v-model="task.data.query"
          :label="$t('macro.api.queryParameters')"
          :add-label="$t('macro.api.addQueryParameter')"
          :key-label="$t('macro.api.parameter')"
          :value-label="$t('macro.api.value')"
          :key-placeholder="$t('macro.api.placeholders.queryKey')"
          :value-placeholder="$t('macro.api.placeholders.queryValue')"
        />
      </v-col>
      <v-col cols="12" md="6">
        <MacroApiKeyValueEditor
          v-model="task.data.headers"
          :label="$t('macro.api.customHeaders')"
          :add-label="$t('macro.api.addHeader')"
          :key-label="$t('macro.api.header')"
          :value-label="$t('macro.api.value')"
          :key-placeholder="$t('macro.api.placeholders.headerKey')"
          :value-placeholder="$t('macro.api.placeholders.headerValue')"
        />
      </v-col>
    </v-row>

    <template v-if="supportsBody">
      <v-row>
        <v-col cols="12" md="4">
          <v-select
            v-model="task.data.body_type"
            variant="outlined"
            :label="$t('macro.api.bodyType')"
            :items="bodyTypes"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model.number="task.data.timeout"
            type="number"
            min="1"
            max="300000"
            variant="outlined"
            :label="$t('macro.api.timeoutMs')"
          />
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center">
          <v-switch
            v-model="task.data.fail_on_error"
            :label="$t('macro.api.failOnHttpError')"
            hide-details
          />
        </v-col>
      </v-row>

      <MacroApiBodyEditor
        v-if="task.data.body_type !== 'none'"
        :body-type="task.data.body_type"
        :body-data="task.data.body_data"
        :form-data="task.data.form_data"
        @update:body-data="task.data.body_data = $event"
        @update:form-data="task.data.form_data = $event"
      />
    </template>

    <v-row v-else>
      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="task.data.timeout"
          type="number"
          min="1"
          max="300000"
          variant="outlined"
          :label="$t('macro.api.timeoutMs')"
        />
      </v-col>
      <v-col cols="12" md="6" class="d-flex align-center">
        <v-switch
          v-model="task.data.fail_on_error"
          :label="$t('macro.api.failOnHttpError')"
          hide-details
        />
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import MacroApiKeyValueEditor from './MacroApiKeyValueEditor.vue'
import MacroApiBodyEditor from './MacroApiBodyEditor.vue'

export default {
  name: 'MacroApiRequestFields',
  components: { MacroApiKeyValueEditor, MacroApiBodyEditor },
  props: {
    task: { type: Object, required: true },
    supportsBody: { type: Boolean, default: true },
  },
  computed: {
    bodyTypes(): Array<{ title: string; value: string }> {
      return [
        { title: this.$t('macro.api.bodyTypes.none'), value: 'none' },
        { title: this.$t('macro.api.bodyTypes.json'), value: 'json' },
        { title: this.$t('macro.api.bodyTypes.form'), value: 'form' },
        { title: this.$t('macro.api.bodyTypes.multipart'), value: 'multipart' },
        { title: this.$t('macro.api.bodyTypes.raw'), value: 'raw' },
      ]
    },
  },
}
</script>
