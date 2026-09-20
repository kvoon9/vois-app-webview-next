<script setup lang="ts">
import PageHeader from '~/components/PageHeader.vue'
import QrCodeCard from '~/components/QrCodeCard.vue'

/**
 * Origin the phone has to reach. A `localhost` URL in a code is only ever openable
 * by the machine that rendered it, so the sheet names this machine on the LAN.
 */
const SCAN_ORIGIN = 'http://192.168.1.87:5173'

/** One batch of Bluetooth AI translate codes, named for the QR sheet. */
const uuids = [
  '7e3f8c99-887d-48d8-aa04-2736a13d932f',
  '487631c5-ee39-4e72-8733-2d01a5a58100',
  '343a22f9-98ad-4281-8335-f5b9e7ba618d',
  '5ef67726-26ca-4f79-bd77-4443bf925232',
  '42655ff1-0619-4c05-9598-2a3b604fc7b1',
  'e7ee7d1f-48f3-44eb-9607-baee44187f03',
  'a7bf8bab-e5fb-4eac-bd98-b296492c6e50',
  'c48fcb0b-a58c-4c06-96d0-5ff6bfe7a73f',
  'f699a9a4-8ab3-4d23-86a7-56bd2d7f5c2e',
  'da03623a-22ac-4a9c-98fe-8689c5587d4a',
  '7b169ac3-2f0c-46b3-9b38-56185c820b3e',
  'f452d660-d7af-48be-a7d5-c9bcf65673ea',
  'a7ccde44-2127-4fec-891d-fd01388aeb23',
  'f43e4719-3535-4b9f-a3dd-2eb6c849c990',
  'f1b6fa4a-0576-4a47-b5c2-2ea7fda51df2',
  '738053fc-a235-404a-b2a7-4358d269c36d',
  'ccaf0507-7162-49fc-9514-2474647b77de',
  '72a16d8b-c8c0-48f6-8b83-f1d9ccf01952',
  '444b4123-d3be-41e7-aef6-bee13f956eef',
  '5b63b68d-92a2-4288-bb6f-e5a5ef692209',
]

function scanUrl(uuid: string): string {
  return `${SCAN_ORIGIN}/#/shared/qrcode/bluetooth-ai-translate-active?uuid=${uuid}`
}
</script>

<template>
  <div class="page">
    <PageHeader title="QR code scan" />

    <main class="p-4">
      <div class="flex flex-wrap -m-2">
        <div v-for="uuid in uuids" :key="uuid" class="w-1/2 p-2 md:w-1/3 xl:w-1/4">
          <QrCodeCard :value="scanUrl(uuid)" :label="uuid" />
        </div>
      </div>
    </main>
  </div>
</template>
