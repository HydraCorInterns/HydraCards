<script setup>
import ErrorMessageComp from "../components/errorMessage.vue";

const route = useRoute()
const errorMessage = ref("There has been an error! Please try again.")
if (route.query.errormsg != undefined){
	errorMessage.value = route.query.errormsg
}

function returnHome(){
	window.location.href='/'
}
</script>

<template>
	<permenantHeader></permenantHeader>
	<div class="max-w-fit m-auto flex flex-col justify-center">
		<ErrorMessageComp>{{errorMessage}}</ErrorMessageComp>
		<button @click="returnHome()" class="px-5 py-2 m-5 hover:bg-red-700 text-slate-50 bg-red-500 rounded-lg">Return Home</button>
	</div>
</template>

