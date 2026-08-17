<template>
  <q-page>
    <div class="q-gutter-y-md">

      <div>
        <div class="section-title">
          <q-icon name="add_circle_outline" size="15px" />
          Novo Apontamento
        </div>
        <div class="card-modern q-pa-md">
          <ApontamentoForm @saved="onSaved" />
        </div>
      </div>

      <div>
        <div class="section-title">
          <q-icon name="today" size="15px" />
          Histórico do Dia
        </div>
        <div class="card-modern overflow-hidden">
          <HistoricoTable />
        </div>
      </div>

    </div>
  </q-page>
</template>

<script setup>
import ApontamentoForm from 'components/ApontamentoForm.vue'
import HistoricoTable from 'components/HistoricoTable.vue'
function onSaved () {}
</script>
