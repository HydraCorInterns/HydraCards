<script setup lang="ts">
import HCUser from "backend/models/HCUser";
import { useRouter } from "vue-router";
const route = useRouter()

const config = useRuntimeConfig()
const props = defineProps(['voteObj'])


const { data: user } = await useFetch("api/user/getUserById?id=" + props.voteObj.userId, {baseURL: config.public.baseUrl})
const currentUser = ref(user.value as HCUser)

const hostClass = ref("")

if (currentUser.value.permissions.host)
{
	hostClass.value = "text-red-500"
}

</script>

<template>
	<div v-if="props.voteObj.vote != ''" :class="hostClass" class="flex">
		<img width="32" height="32" :src="currentUser.avatar" alt="Avatar" class="mr-2" /> {{currentUser.displayName}} - {{props.voteObj.vote}}
	</div>
	<div v-else :class="hostClass" class="flex">
		<img width="32" height="32" :src="currentUser.avatar" alt="Avatar" class="mr-2" /> {{currentUser.displayName}} - N/A
	</div>
</template>