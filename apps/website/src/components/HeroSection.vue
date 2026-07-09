<script setup lang="ts">
import typescriptLogo from '~/assets/typescript.svg'
import viteLogo from '~/assets/vite.svg'
import heroImg from '~/assets/hero.png'
</script>

<template>
  <div class="relative">
    <img :src="heroImg" class="relative z-0 mx-auto w-[170px]" width="170" height="179" />
    <img
      :src="typescriptLogo"
      class="absolute top-[34px] z-1 mx-auto h-[28px] left-0 right-0 transform-[perspective(2000px)_rotateZ(300deg)_rotateX(44deg)_rotateY(39deg)_scale(1.4)]"
      alt="TypeScript logo"
    />
    <img
      :src="viteLogo"
      class="absolute top-[107px] z-0 mx-auto h-[26px] w-auto left-0 right-0 transform-[perspective(2000px)_rotateZ(300deg)_rotateX(40deg)_rotateY(39deg)_scale(0.8)]"
      alt="Vite logo"
    />
  </div>
</template>
