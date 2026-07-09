<script setup lang="ts">
import typescriptLogo from '~/assets/typescript.svg'
import viteLogo from '~/assets/vite.svg'

const docLinks = [
  { href: 'https://vite.dev/', icon: viteLogo, iconClass: 'h-[18px]', text: 'Explore Vite' },
  {
    href: 'https://www.typescriptlang.org',
    icon: typescriptLogo,
    iconClass: 'h-[18px] w-[18px]',
    text: 'Learn more',
  },
]

const socialLinks = [
  { href: 'https://github.com/vitejs/vite', icon: 'github-icon', text: 'GitHub' },
  { href: 'https://chat.vite.dev/', icon: 'discord-icon', text: 'Discord' },
  { href: 'https://x.com/vite_js', icon: 'x-icon', text: 'X.com' },
  { href: 'https://bsky.app/profile/vite.dev', icon: 'bluesky-icon', text: 'Bluesky' },
]
</script>

<template>
  <section
    id="next-steps"
    class="flex border-t border-t-[#e5e4e7] dark:border-t-[#2e303a] text-left lt-lg:flex-col lt-lg:text-center"
  >
    <div
      id="docs"
      class="flex-1 p-8 lt-lg:p-6 lt-lg:px-5 border-r border-r-[#e5e4e7] dark:border-r-[#2e303a] lt-lg:border-r-0 lt-lg:border-b lt-lg:border-b-[#e5e4e7] dark:lt-lg:border-b-[#2e303a]"
    >
      <svg class="mb-4 w-[22px] h-[22px]" role="presentation" aria-hidden="true">
        <use href="/icons.svg#documentation-icon" />
      </svg>
      <h2
        class="text-[24px] lt-lg:text-xl leading-[118%] tracking-[-0.24px] mb-2 text-[#08060d] dark:text-[#f3f4f6] font-medium"
      >
        Documentation
      </h2>
      <p class="m-0">Your questions, answered</p>
      <ul class="list-none p-0 flex mt-8 lt-lg:mt-5 lt-lg:flex-wrap lt-lg:justify-center m-0">
        <li
          v-for="link in docLinks"
          :key="link.href"
          class="ml-2 first:ml-0 lt-lg:mb-2 lt-lg:odd:ml-0 lt-lg:flex-1 lt-lg:basis-[calc(50%-8px)]"
        >
          <a
            :href="link.href"
            target="_blank"
            class="text-[#08060d] dark:text-[#f3f4f6] text-base rounded-md bg-[rgba(244,243,236,0.5)] dark:bg-[rgba(47,48,58,0.5)] flex px-3 py-1.5 items-center space-x-2 no-underline transition-[box-shadow] duration-300 hover:shadow-[rgba(0,0,0,0.1)_0_10px_15px_-3px,rgba(0,0,0,0.05)_0_4px_6px_-2px] dark:hover:shadow-[rgba(0,0,0,0.4)_0_10px_15px_-3px,rgba(0,0,0,0.25)_0_4px_6px_-2px] lt-lg:w-full lt-lg:justify-center box-border"
          >
            <img :class="link.iconClass" :src="link.icon" alt="" />
            <span>{{ link.text }}</span>
          </a>
        </li>
      </ul>
    </div>

    <div id="social" class="flex-1 p-8 lt-lg:p-6 lt-lg:px-5">
      <svg class="mb-4 w-[22px] h-[22px]" role="presentation" aria-hidden="true">
        <use href="/icons.svg#social-icon" />
      </svg>
      <h2
        class="text-[24px] lt-lg:text-xl leading-[118%] tracking-[-0.24px] mb-2 text-[#08060d] dark:text-[#f3f4f6] font-medium"
      >
        Connect with us
      </h2>
      <p class="m-0">Join the Vite community</p>
      <ul class="list-none p-0 flex mt-8 lt-lg:mt-5 lt-lg:flex-wrap lt-lg:justify-center m-0">
        <li
          v-for="link in socialLinks"
          :key="link.href"
          class="ml-2 first:ml-0 lt-lg:mb-2 lt-lg:odd:ml-0 lt-lg:flex-1 lt-lg:basis-[calc(50%-8px)]"
        >
          <a
            :href="link.href"
            target="_blank"
            class="text-[#08060d] dark:text-[#f3f4f6] text-base rounded-md bg-[rgba(244,243,236,0.5)] dark:bg-[rgba(47,48,58,0.5)] flex px-3 py-1.5 items-center space-x-2 no-underline transition-[box-shadow] duration-300 hover:shadow-[rgba(0,0,0,0.1)_0_10px_15px_-3px,rgba(0,0,0,0.05)_0_4px_6px_-2px] dark:hover:shadow-[rgba(0,0,0,0.4)_0_10px_15px_-3px,rgba(0,0,0,0.25)_0_4px_6px_-2px] lt-lg:w-full lt-lg:justify-center box-border"
          >
            <svg
              class="h-[18px] w-[18px] dark:invert dark:brightness-[2]"
              role="presentation"
              aria-hidden="true"
            >
              <use :href="`/icons.svg#${link.icon}`" />
            </svg>
            <span>{{ link.text }}</span>
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>
