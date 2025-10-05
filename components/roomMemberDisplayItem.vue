<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router";
import HCRoom from "../backend/models/HCRoom";
import HCUser from "../backend/models/HCUser";


const props = defineProps(['member', "roomStatus", "userId", "lowestVote", "highestVote"])
const hostClass = ref("")
const statusIcon = ref("❌")
const onlineIcon = ref("💻")
const focusedIcon = ref("😵")
const config = useRuntimeConfig()
const name = ref(props.member.displayName)
const showUserInfo = ref(false)
const currentUser = ref(new HCUser)
const colorMode = useColorMode()

const { data: user } = await useFetch(`api/user/getUserById?id=` + props.userId, { baseURL: config.public.baseUrl })
currentUser.value = user.value as HCUser


if (props.member.permissions.host) {
	hostClass.value = "text-red-500"
}
if (props.member.anonymous && props.member.allowanon) {
	name.value = "Anonymous"
}

var room: HCRoom = JSON.parse(localStorage.getItem("room") as string) as HCRoom
if (props.roomStatus == 0) {
	switch (props.member.userVotingStatus) {
		case 0:
			statusIcon.value = "❌"
			break;
		case 1:
			statusIcon.value = "👀"
			break;
		case 2:
			statusIcon.value = "✅"
			break;
	}
} else {
	if (props.member.userVotingStatus == 1) {
		statusIcon.value = "👀"
	} else {
		//@ts-ignore
		statusIcon.value = room.votes[props.member.id]
		if (statusIcon.value == undefined || statusIcon.value == "") {
			statusIcon.value = "N/A"
		}
	}
}
if (props.member.online) {
	onlineIcon.value = "🌎" //ON LINE
} else {
	onlineIcon.value = "🌐" //OFF LINE
}
if (props.member.focused) {
	focusedIcon.value = "😎"
} else {
	focusedIcon.value = "💤"
}
if (!props.member.online) {
	focusedIcon.value = ""
}

watch(props, () => {
	console.log("CHILD MIN MAX", props.lowestVote, props.highestVote)
	if (props.member.permissions.host) {
		hostClass.value = "text-red-500"
	}
	var room: HCRoom = JSON.parse(localStorage.getItem("room") as string) as HCRoom
	if (props.roomStatus == 0) {
		switch (props.member.userVotingStatus) {
			case 0:
				statusIcon.value = "❌"
				break;
			case 1:
				statusIcon.value = "👀"
				break;
			case 2:
				statusIcon.value = "✅"
				break;
		}
	} else {
		if (props.member.userVotingStatus == 1) {
			statusIcon.value = "👀"
		} else {
			//@ts-ignore
			statusIcon.value = room.votes[props.member.id]
			if (statusIcon.value == undefined || statusIcon.value == "") {
				statusIcon.value = "N/A"
			}
		}
	}

	if (props.member.online) {
		onlineIcon.value = "🌎" //ON LINE
	} else {
		onlineIcon.value = "🌐" //OFF LINE
	}
	name.value = props.member.displayName

	if (props.member.focused) {
		focusedIcon.value = "😎"
	} else {
		focusedIcon.value = "💤"
	}
	if (!props.member.online) {
		focusedIcon.value = ""
	}

	if (props.member.anonymous && props.member.allowAnon) {
		name.value = "Anonymous"
	}
})
</script>

<template>
	<div class="flex">
		<!--<p :class="hostClass"></p>-->
		<div class="pl-6 pr-6 dark:text-slate-400 font-semibold flex w-full justify-between">
			<div @click="showUserInfo = true" class="flex items-center cursor-pointer">
				<img width="32" height="32" :src="member.avatar" alt="Avatar" class="mr-2" />
				<p class="h-fit">{{ name }}</p>
			</div>
			<div class="flex gap-6 items-end">
				<div class="grid grid-cols-4 gap-1 relative">
					<div class="text-center" v-show="props.member.permissions.host">🌟</div>
					<div class="text-center" v-show="!props.member.permissions.host"></div>
					<div class="text-center"> {{ focusedIcon }}</div>
					<div class="text-center"> {{ onlineIcon }}</div>
					<div class="w-[30px] text-center" v-if="statusIcon != 'Coffee Break'"> {{ statusIcon }}</div>
					<svg v-if="statusIcon == 'Coffee Break' && colorMode.preference == 'dark'" width="30" height="24"
						viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M9.85553 17.7754H14.0136C15.392 17.7754 16.714 17.2246 17.6888 16.2441C18.6635 15.2637 19.2111 13.9339 19.2111 12.5473V11.5017H20.2506C21.0777 11.5017 21.8709 11.1712 22.4557 10.5829C23.0406 9.99465 23.3691 9.19678 23.3691 8.36483C23.3691 7.53288 23.0406 6.73501 22.4557 6.14673C21.8709 5.55845 21.0777 5.22796 20.2506 5.22796H19.2111V4.18234C19.2111 3.90502 19.1016 3.63907 18.9066 3.44297C18.7117 3.24688 18.4473 3.13672 18.1716 3.13672H5.6975C5.42181 3.13672 5.1574 3.24688 4.96246 3.44297C4.76751 3.63907 4.65799 3.90502 4.65799 4.18234V12.5473C4.65799 13.9339 5.20559 15.2637 6.18032 16.2441C7.15504 17.2246 8.47706 17.7754 9.85553 17.7754ZM19.2111 7.31921H20.2506C20.5263 7.31921 20.7907 7.42937 20.9856 7.62546C21.1806 7.82155 21.2901 8.08751 21.2901 8.36483C21.2901 8.64214 21.1806 8.9081 20.9856 9.10419C20.7907 9.30029 20.5263 9.41045 20.2506 9.41045H19.2111V7.31921ZM6.73701 5.22796H17.1321V12.5473C17.1321 13.3793 16.8035 14.1771 16.2187 14.7654C15.6339 15.3537 14.8406 15.6842 14.0136 15.6842H9.85553C9.02845 15.6842 8.23524 15.3537 7.6504 14.7654C7.06557 14.1771 6.73701 13.3793 6.73701 12.5473V5.22796ZM22.3296 19.8667H3.61849C3.34279 19.8667 3.07839 19.9768 2.88344 20.1729C2.6885 20.369 2.57898 20.635 2.57898 20.9123C2.57898 21.1896 2.6885 21.4556 2.88344 21.6517C3.07839 21.8477 3.34279 21.9579 3.61849 21.9579H22.3296C22.6053 21.9579 22.8697 21.8477 23.0647 21.6517C23.2596 21.4556 23.3691 21.1896 23.3691 20.9123C23.3691 20.635 23.2596 20.369 23.0647 20.1729C22.8697 19.9768 22.6053 19.8667 22.3296 19.8667Z"
							fill="#94A3B8" />
					</svg>
					<svg v-if="statusIcon == 'Coffee Break' && colorMode.preference == 'light'" width="24" height="24"
						viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M9.85553 17.7754H14.0136C15.392 17.7754 16.714 17.2246 17.6888 16.2441C18.6635 15.2637 19.2111 13.9339 19.2111 12.5473V11.5017H20.2506C21.0777 11.5017 21.8709 11.1712 22.4557 10.5829C23.0406 9.99465 23.3691 9.19678 23.3691 8.36483C23.3691 7.53288 23.0406 6.73501 22.4557 6.14673C21.8709 5.55845 21.0777 5.22796 20.2506 5.22796H19.2111V4.18234C19.2111 3.90502 19.1016 3.63907 18.9066 3.44297C18.7117 3.24688 18.4473 3.13672 18.1716 3.13672H5.6975C5.42181 3.13672 5.1574 3.24688 4.96246 3.44297C4.76751 3.63907 4.65799 3.90502 4.65799 4.18234V12.5473C4.65799 13.9339 5.20559 15.2637 6.18032 16.2441C7.15504 17.2246 8.47706 17.7754 9.85553 17.7754ZM19.2111 7.31921H20.2506C20.5263 7.31921 20.7907 7.42937 20.9856 7.62546C21.1806 7.82155 21.2901 8.08751 21.2901 8.36483C21.2901 8.64214 21.1806 8.9081 20.9856 9.10419C20.7907 9.30029 20.5263 9.41045 20.2506 9.41045H19.2111V7.31921ZM6.73701 5.22796H17.1321V12.5473C17.1321 13.3793 16.8035 14.1771 16.2187 14.7654C15.6339 15.3537 14.8406 15.6842 14.0136 15.6842H9.85553C9.02845 15.6842 8.23524 15.3537 7.6504 14.7654C7.06557 14.1771 6.73701 13.3793 6.73701 12.5473V5.22796ZM22.3296 19.8667H3.61849C3.34279 19.8667 3.07839 19.9768 2.88344 20.1729C2.6885 20.369 2.57898 20.635 2.57898 20.9123C2.57898 21.1896 2.6885 21.4556 2.88344 21.6517C3.07839 21.8477 3.34279 21.9579 3.61849 21.9579H22.3296C22.6053 21.9579 22.8697 21.8477 23.0647 21.6517C23.2596 21.4556 23.3691 21.1896 23.3691 20.9123C23.3691 20.635 23.2596 20.369 23.0647 20.1729C22.8697 19.9768 22.6053 19.8667 22.3296 19.8667Z"
							fill="#000000" />
					</svg>
					<div class="w-[30px] text-center absolute -right-4 font-mono" v-if="props.highestVote == statusIcon || props.lowestVote == statusIcon">*</div>
				</div>
			</div>
		</div>
	</div>
	<ModalPopup @close="showUserInfo = false" v-if="showUserInfo
		&& (props.member.id == props.userId
			|| (currentUser.permissions.host && !props.member.permissions.host)
			|| currentUser.permissions.admin)">
		<memberInfo :user-id=props.userId :member=props.member @cancel="showUserInfo = false;"></memberInfo>
	</ModalPopup>
</template>