<script setup>
import { computed } from 'vue';
import {
  IconBell,
  IconAddressBook,
  IconBuilding,
  IconBuildingCommunity,
  IconBuildingEstate,
  IconBuildingFactory2,
  IconCalendarClock,
  IconCalendarEvent,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconDotsCircleHorizontal,
  IconGridDots,
  IconHelpCircle,
  IconLayoutDashboard,
  IconLogout,
  IconMessages,
  IconMicrophone,
  IconNews,
  IconPaperclip,
  IconPhoto,
  IconFile,
  IconFileText,
  IconCircleCheck,
  IconRadar,
  IconSettings,
  IconShieldCog,
  IconSpeakerphone,
  IconTrophy,
  IconUsers,
  IconX,
} from '@tabler/icons-vue';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  title: { type: String, default: '' },
});

const icons = {
  'address-book': IconAddressBook,
  bell: IconBell,
  building: IconBuilding,
  'building-community': IconBuildingCommunity,
  'building-estate': IconBuildingEstate,
  'building-factory': IconBuildingFactory2,
  'calendar-clock': IconCalendarClock,
  'calendar-event': IconCalendarEvent,
  'chart-bar': IconChartBar,
  'chevron-left': IconChevronLeft,
  'chevron-right': IconChevronRight,
  'dots-circle-horizontal': IconDotsCircleHorizontal,
  'grid-dots': IconGridDots,
  'help-circle': IconHelpCircle,
  'layout-dashboard': IconLayoutDashboard,
  logout: IconLogout,
  messages: IconMessages,
  microphone: IconMicrophone,
  news: IconNews,
  paperclip: IconPaperclip,
  photo: IconPhoto,
  file: IconFile,
  'file-text': IconFileText,
  'circle-check': IconCircleCheck,
  radar: IconRadar,
  settings: IconSettings,
  'shield-cog': IconShieldCog,
  speakerphone: IconSpeakerphone,
  trophy: IconTrophy,
  users: IconUsers,
  x: IconX,
};
const component = computed(() => icons[props.name] || IconHelpCircle);
</script>

<template>
  <component :is="component" :size="Number(size)" :stroke-width="1.5" :aria-label="title || undefined" :aria-hidden="title ? undefined : true" />
</template>
