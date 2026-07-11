<template>
  <div>
    <v-row>
      <v-col cols="12" md="8">
        <v-text-field v-model="task.data.url" variant="outlined" label="URL" placeholder="https://example.com/api/items" />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field v-model="task.data.result_variable" variant="outlined" label="Result variable" placeholder="api_response" />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <MacroApiKeyValueEditor
          v-model="task.data.query"
          label="Query parameters"
          add-label="Add query parameter"
          key-label="Parameter"
          value-label="Value"
          key-placeholder="limit"
          value-placeholder="10"
        />
      </v-col>
      <v-col cols="12" md="6">
        <MacroApiKeyValueEditor
          v-model="task.data.headers"
          label="Custom headers"
          add-label="Add header"
          key-label="Header"
          value-label="Value"
          key-placeholder="Authorization"
          value-placeholder="Bearer ${token}"
        />
      </v-col>
    </v-row>

    <template v-if="supportsBody">
      <v-row>
        <v-col cols="12" md="4">
          <v-select
            v-model="task.data.body_type"
            variant="outlined"
            label="Body type"
            :items="bodyTypes"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model.number="task.data.timeout" type="number" min="1" max="300000" variant="outlined" label="Timeout (ms)" />
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center">
          <v-switch v-model="task.data.fail_on_error" label="Fail macro task on HTTP error" hide-details />
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
        <v-text-field v-model.number="task.data.timeout" type="number" min="1" max="300000" variant="outlined" label="Timeout (ms)" />
      </v-col>
      <v-col cols="12" md="6" class="d-flex align-center">
        <v-switch v-model="task.data.fail_on_error" label="Fail macro task on HTTP error" hide-details />
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
  data() {
    return {
      bodyTypes: [
        { title: 'No body', value: 'none' },
        { title: 'JSON', value: 'json' },
        { title: 'Form URL encoded', value: 'form' },
        { title: 'Multipart form data', value: 'multipart' },
        { title: 'Raw body', value: 'raw' },
      ],
    }
  },
}
</script>
