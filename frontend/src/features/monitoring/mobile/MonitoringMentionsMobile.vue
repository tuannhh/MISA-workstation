<script setup>
import { ref, watch } from 'vue';
import MButton from '../../../components/mds/MButton.vue';
import MEmptyState from '../../../components/mds/MEmptyState.vue';
import MInput from '../../../components/mds/MInput.vue';
import MMobileTopBar from '../../../components/mds/MMobileTopBar.vue';
import MSelect from '../../../components/mds/MSelect.vue';
import MTag from '../../../components/mds/MTag.vue';

const props=defineProps({rows:{type:Array,default:()=>[]},total:Number,page:Number,pageSize:Number,search:String,category:String,sentiment:String,status:String,loading:Boolean,safeAreaStyle:Object,canEdit:Boolean});
const emit=defineEmits(['back','search','filters','page']);
const draftSearch=ref(props.search||'');
watch(()=>props.search,(value)=>{draftSearch.value=value||'';});
const categories=[{value:'',label:'Mọi phân loại'},{value:'brand',label:'Thương hiệu'},{value:'industry',label:'Tin ngành'},{value:'competitor',label:'Đối thủ'}];
const sentiments=[{value:'',label:'Mọi sắc thái'},{value:'positive',label:'Tích cực'},{value:'neutral',label:'Trung tính'},{value:'negative',label:'Tiêu cực'}];
const statuses=[{value:'',label:'Mọi trạng thái'},{value:'Mới',label:'Mới'},{value:'Đang xử lý',label:'Đang xử lý'},{value:'Đã xử lý',label:'Đã xử lý'}];
function apply(key,value){emit('filters',{[key]:value});}
</script>

<template><section class="mds-mobile-app flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-[var(--mds-bg)]" :style="safeAreaStyle"><MMobileTopBar title="Tin bài giám sát" @back="emit('back')"/><main class="min-h-0 flex-1 overflow-y-auto pb-[var(--mds-mobile-safe-bottom)]"><div class="mds-mobile-gutter-x space-y-4 py-4"><form @submit.prevent="emit('search',draftSearch)"><MInput v-model="draftSearch" placeholder="Tìm tiêu đề hoặc nguồn…"/></form><div class="grid grid-cols-1 gap-2"><MSelect :model-value="category" :options="categories" @update:model-value="apply('category',$event)"/><MSelect :model-value="sentiment" :options="sentiments" @update:model-value="apply('sentiment',$event)"/><MSelect :model-value="status" :options="statuses" @update:model-value="apply('status',$event)"/></div><p class="text-[13px] text-[var(--mds-text-secondary)]">{{total||0}} tin theo bộ lọc hiện tại.</p></div><div v-if="rows.length" class="divide-y divide-[var(--mds-border-light)]"><article v-for="row in rows" :key="row.id" class="mds-mobile-gutter-x py-4"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><a v-if="row.link" :href="row.link" target="_blank" rel="noopener noreferrer" class="block truncate text-[14px] font-semibold text-[var(--mds-brand-600)]">{{row.title}}</a><strong v-else class="block truncate text-[14px]">{{row.title}}</strong><p class="mt-1 truncate text-[13px] text-[var(--mds-text-secondary)]">{{row.sourceName||'—'}} · {{row.publishedAt||'—'}}</p></div><MTag :color="row.sentiment==='negative'?'danger':row.sentiment==='positive'?'success':'neutral'">{{row.sentiment||'—'}}</MTag></div><p v-if="row.summary" class="mt-2 text-[13px] leading-[18px]">{{row.summary}}</p><div class="mt-2 flex gap-2"><MTag color="neutral">{{row.category||'—'}}</MTag><MTag color="neutral">{{row.status||'—'}}</MTag></div><div v-if="canEdit" class="mt-2 flex justify-end"><MButton variant="link" class="[&]:h-[var(--mds-mobile-touch-target)]" @click="emit('review',row)">Cập nhật</MButton></div></article></div><MEmptyState v-else title="Chưa có tin bài" description="Thử đổi bộ lọc hoặc chạy quét từ quy trình được phê duyệt."/><footer class="mds-mobile-gutter-x flex gap-2 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] py-3"><MButton variant="neutral" class="flex-1 [&]:h-[var(--mds-mobile-touch-target)]" :disabled="loading||page<=1" @click="emit('page',page-1)">Trước</MButton><MButton variant="neutral" class="flex-1 [&]:h-[var(--mds-mobile-touch-target)]" :disabled="loading||page*pageSize>=total" @click="emit('page',page+1)">Sau</MButton></footer></main></section></template>
