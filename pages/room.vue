<script setup lang="ts">
import HCRoom from "../backend/models/HCRoom";
import HCUser from "../backend/models/HCUser";
import { ref } from "vue"
import { useRouter } from "vue-router";
import { io } from "socket.io-client";
import roomMemberDisplayItem from "../components/roomMemberDisplayItem.vue";
import { HCRoomStatus } from "../backend/models/HCRoomStatus";
import { TSMap } from "typescript-map"

//@ts-ignore
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, Title } from 'chart.js'
//@ts-ignore
import { Pie, Bar, Doughnut } from 'vue-chartjs'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { HCVotingStatus } from "../backend/models/HCVotingStatus";
ChartJS.register(ArcElement, Tooltip, Legend)
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ChartDataLabels)

const colormode = useColorMode()
let backgroundColor = []

if(colormode.preference == 'dark'){
	backgroundColor = ['#FF7700', '#E04D01', '#ffa500', '#DC3A38','#F16523','#CD2321','#BB1412','#B88240','#6C389D','#A0275C','#E86EA2','#F6AFAF','#784D05']
} else {
	backgroundColor = ['#3765B7','#112D5F','#1A3D7D','#26509B','#0C2045','#4D7CCE','#6A95E1','#8EB1ED','#33A6A0','#54C7C1','#45449D','#6E6DCF','#1C1B47']
}

const pieData = ref({
	labels: [''],
	datasets: [
		{
			label: 'count',
			backgroundColor: backgroundColor,
			data: new Array<number>,
		}
	],
})

const chartOptions = ref({
	responsive: true,
	maintainAspectRatio: true,
	color: '#FFFFFF',
	plugins: {
		datalabels: {
			color: '#FFFFFF',
			font: {
				size: 30, 
			},
			formatter: (val: any, ctx: any) => ctx.chart.data.labels[ctx.dataIndex],
		},
	},
})


const config = useRuntimeConfig()
const route = useRouter()

const showStoryPointsPrompt = ref(false)
const selectedChart = ref("pie")
let socket = io()
const displayName = ref("")
const roomTopicName = ref("")
const roomUrlName = ref("")
const selectedCard = ref()
const lastCard = ref("")
const currentUser = ref(new HCUser)
const currentRoom = ref(new HCRoom)
const currentRoomMembers: Ref<Array<HCUser>> = ref(new Array<HCUser>)
const lowestVote = ref(0)
const highestVote = ref(0)

const userId: Ref<string> = ref(useCookie('_id').value as string)
let roomId: string = route.currentRoute.value.query.id as string
const showQRCodeModal = ref(false)
const minutes:Ref<string> = ref("00")
const seconds:Ref<string> = ref("00")
const roomLink = ref("")
const allowAnonymousMode = ref(true)
const pie = ref()
const bar = ref()
const doughnut = ref()

const cards = ref(["0", "1/2", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "Coffee Break"])

const { data: room } = await useFetch(`api/room/getRoomById?id=` + roomId, { baseURL: config.public.baseUrl })
currentRoom.value = room.value as HCRoom

let votes: TSMap<string, number> = getRoomVotesMap(currentRoom.value)
pieData.value.labels = votes.keys()
pieData.value.datasets[0].data = votes.values()

const { data: user } = await useFetch(`api/user/getUserById?id=` + userId.value, { baseURL: config.public.baseUrl })
currentUser.value = user.value as HCUser
let currentToken = useCookie('token').value


async function apiJoinRoom() {
	let response = await useFetch(`api/room/joinRoom?id=` + roomId, { credentials: "include", baseURL: config.public.baseUrl })

	// @ts-ignore
	let room: HCRoom = response.data.value?.room as unknown as HCRoom
	//router.push({ path: 'room', query: { id: room.id } })
	//TODO: Find a way to have router.push not be shallow redirect
	window.location.href = "/room?id=" + room.id
}
async function socketLeaveRoom() {
	// @ts-ignore
	socket.emit("leaveRoom", room.value?.id as Number, userId.value as string, currentToken)
	window.location.href = "/"
}
function socketDisplayResults() {
	socket.emit("displayResults", Number.parseInt(roomId), userId.value, currentToken)
}
function socketRevote() {
	socket.emit("revote", currentRoom.value.id, userId.value, true, undefined, currentToken)
}
function socketNewTopic(points:number) {
	socket.emit("revote", currentRoom.value.id, userId.value, false, points, currentToken)
	roomTopicName.value = ""
	socketSetTopicName()
	showStoryPointsPrompt.value = false
	roomUrlName.value = ""
	socketSetUrl()
}

function isInRoom() {
	const roomExists = currentRoom.value != undefined
	const userExists = currentUser.value != undefined
	const userInRoom = currentRoom.value?.members.findIndex((id) => userId.value == id) != -1
	if (roomExists && userExists && userInRoom) {
		return true
	}
	return false
}
async function apiSetDisplayName() {
	await useFetch(`api/user/setname?name=` + displayName.value, { credentials: "include", baseURL: config.public.baseUrl })
}
function socketSetName() {
	socket.emit("setMemberName", currentRoom.value.id, currentUser.value.id, displayName.value, currentToken)
}
function submitVote(vote: string, event:any) {
	let element = event.target

	if (element.localName == 'p' || element.localName == "svg"){
		element = element.parentElement
	}

	if (selectedCard.value != undefined){
		selectedCard.value.classList.replace("bg-blue-800","bg-gray-300")
		selectedCard.value.classList.replace("text-gray-300", "text-black")
		selectedCard.value.classList.replace("dark:bg-orange-500","dark:bg-gray-700")
	}

	socket.emit("submitVote", Number.parseInt(roomId), userId.value, vote, currentToken)
	element.classList.replace("bg-gray-300","bg-blue-800")
	element.classList.replace("text-black", "text-gray-300")
	element.classList.replace("dark:bg-gray-700", "dark:bg-orange-500")
	selectedCard.value = element
	lastCard.value = vote
}
function getRoomVotesMap(room: HCRoom) {
	let votes: TSMap<string, number> = new TSMap<string, number>()

	if (!room) {
		return votes
	}

	Object.values(room.votes).forEach((vote: number) => {
		if (vote.toString() == '') {
			return
		}

		let curr: number = votes.get(vote.toString())
		if (curr == undefined) {
			curr = 0
		}
		votes.set(vote.toString(), curr + 1)
	})
	votes.delete("-1")
	return votes
}
function getWinningVote(room: HCRoom): number {
	const votes = getRoomVotesMap(room)
	const result = votes.values().every(count => count === votes.values()[0])
	if (result && votes.length > 1 || votes.length == 0) {
		return 0
	}
	const highest = votes.keys().reduce((a, b) => votes.get(a) > votes.get(b) ? a : b)
	return Number.parseInt(highest)
}
function socketSetTopicName() {
	socket.emit("setRoomTopicName", currentRoom.value.id, currentUser.value.id, roomTopicName.value, currentToken)
}
function socketSetUrl() {
	socket.emit("setRoomUrl", currentRoom.value.id, currentUser.value.id, roomUrlName.value, currentToken)
}
function socketStartCount() {
	socket.emit("startCount", currentRoom.value.id, currentUser.value.id, Number.parseInt(minutes.value) * 60 + Number.parseInt(seconds.value), currentToken)
}
function socketCancelCount() {
	socket.emit("cancelCount", currentRoom.value.id, currentUser.value.id, currentRoom.value.counter.default, currentToken);
}
function socketStopCount() {
	socket.emit("cancelCount", currentRoom.value.id, currentUser.value.id, Number.parseInt(minutes.value) * 60 + Number.parseInt(seconds.value), currentToken);
}
function downloadBase64File(contentBase64: string, fileName: string) {
	const linkSource = contentBase64;
	const downloadLink = document.createElement('a');
	document.body.appendChild(downloadLink);

	downloadLink.href = linkSource;
	downloadLink.target = '_self';
	downloadLink.download = fileName;
	downloadLink.click();
}
function downloadCharts() {
	downloadBase64File(ChartJS.instances[0].toBase64Image(), "pie.png")
	downloadBase64File(ChartJS.instances[1].toBase64Image(), "bar.png")
}
async function downloadTopicCSV(topicIndex: number, topicName: string) {
	let response = await useFetch(`api/room/csv`, { baseURL: config.public.baseUrl, query: { id: currentRoom.value.id, topic: topicIndex } })
	const blob = new Blob([response.data.value as any], { type: 'text/csv' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = topicName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
function confirmHyperlink(link: string) {
	if (window.confirm("Trust this link?")) {
		window.open(link);
	}
}
const copied = ref(false)
function copy() {
	navigator.clipboard.writeText(window.location.href)
	copied.value = true
	setTimeout(() => copied.value = false, 2000)
}
function socketSetCoffeeBreak(enabled:boolean){
	socket.emit("coffeebreak", currentRoom.value.id, currentUser.value.id, enabled, currentToken)
}
function mounted(){
	socket = io(config.public.baseUrl.replace("http", "ws").replace("https", "wss"))
	socket.on("connect_error", (err) => {
		console.log(`connect_error due to ${err.message}`);
	});
	socket.on("connect", () => {
		socket.emit("joinSocketRoom", Number.parseInt(roomId), userId.value as string, currentToken)
		socket.emit("setSocketId", currentUser.value.id, currentToken)
		setInterval(() => { 
			socket.emit("onlinePing", currentUser.value.id, document.hasFocus(), currentToken) 
	}, 1000)
	})
	socket.on("roomStateUpdate", (room: HCRoom, members: Array<HCUser>) => {
		if (!room || !members) {
			return
		}
		let oldRoom: HCRoom = currentRoom.value

		currentRoom.value = room
		localStorage.setItem("room", JSON.stringify(currentRoom.value))
		currentRoomMembers.value = members;
		currentUser.value = currentRoomMembers.value.find(member => member.id == userId.value) as HCUser

		if (currentRoom.value.status == HCRoomStatus.reviewing){
			// sort currentRoomMembers.value by vote
			currentRoomMembers.value = currentRoomMembers.value.sort((a, b) => {
				//@ts-ignore
				const voteA = currentRoom.value.votes[a.id] ?? -1;
				//@ts-ignore
				const voteB = currentRoom.value.votes[b.id] ?? -1;
				return voteA - voteB;
			});
			//@ts-ignore
			lowestVote.value = Math.min(...Object.values(currentRoom.value.votes).filter(vote => vote >= 0));
			//@ts-ignore
			highestVote.value = Math.max(...Object.values(currentRoom.value.votes).filter(vote => vote >= 0));
			if (lowestVote.value == highestVote.value){
				lowestVote.value = NaN
			}
			console.log("PARENT MIN MAX", lowestVote.value, highestVote.value)
		}

		displayName.value = currentUser.value.displayName

		if (currentRoom.value.counter.count < 0){
			currentRoom.value.counter.count = 0
		}

		let minnum:number = Math.floor(currentRoom.value.counter.count / 60)
		let secnum:number = currentRoom.value.counter.count % 60

		if (minnum == 0){
			minutes.value = "00"
		} else {
			minutes.value = minnum.toString().padStart(2, "0")
		}

		if (secnum == 0){
			seconds.value = "00"
		} else {
			seconds.value = secnum.toString().padStart(2, "0")
		}

		if (currentRoom.value.topicName != roomTopicName.value && !currentUser.value.permissions.host){
			roomTopicName.value = currentRoom.value.topicName
		}
		if (currentRoom.value.urlName != roomUrlName.value && !currentUser.value.permissions.host){
			roomUrlName.value = currentRoom.value.urlName
		}
		
		let votes: TSMap<string, number> = getRoomVotesMap(currentRoom.value)
		pieData.value.labels = votes.keys()
		pieData.value.datasets[0].data = votes.values()
		if (currentRoom.value.revote && oldRoom.status != currentRoom.value.status && currentRoom.value.status != HCRoomStatus.coffeebreak && lastCard.value != "") {
			nextTick(()=>{
				selectedCard.value = document.getElementById(lastCard.value)
				if (selectedCard.value){
					selectedCard.value.classList.replace("bg-blue-800", "bg-gray-300")
					selectedCard.value.classList.replace("text-gray-300", "text-black")
					selectedCard.value.classList.replace("dark:bg-orange-500", "dark:bg-gray-700")
				}
			})
		}
		nextTick(()=>{
			updateColors()
		})
	})
	socket.on("kick", (id:string) => {
		if (id == currentUser.value.id){
			window.location.href = "/?kicked=true"
		}
	})
	socket.on("invalidToken", () => {
		//reload the page
		window.location.reload()
	})
	roomLink.value = window.location.href
	if (roomTopicName.value == "" || roomTopicName == undefined){
		roomTopicName.value = currentRoom.value.topicName
		
	}
	if (roomUrlName.value == ""|| roomUrlName == undefined){
		roomUrlName.value = currentRoom.value.urlName
	}
}


onMounted(mounted)

definePageMeta({
	middleware: ["nullroomredirect"]
})

watch(displayName, socketSetName)
watch(minutes, ()=>{
	if (minutes.value != undefined) {
		minutes.value = minutes.value.replace(/[^0-9]/g, '');
	}
})
watch(seconds, ()=>{
	if (seconds.value != undefined) {
		seconds.value = seconds.value.replace(/[^0-9]/g, '');
	}
})

function updateColors() {
	let backgroundColor = []
	let legendColor = ''

	if(colormode.preference == 'dark'){
		backgroundColor = ['#FF7700', '#FF8955', '#FFA18D', '#DAF5F3','#7DE0DB','#33A6A0','#10605C','#B88240','#6C389D','#A0275C','#E86EA2','#F6AFAF','#784D05']
		legendColor = 'white'
	} else {
		backgroundColor = ['#3765B7','#112D5F','#1A3D7D','#26509B','#0C2045','#4D7CCE','#6A95E1','#8EB1ED','#33A6A0','#54C7C1','#45449D','#6E6DCF','#1C1B47']
		legendColor = 'black'
	}
	let chart = undefined
	if (pie.value != undefined){
		if (pie.value.chart != undefined){
			chart = pie.value.chart
		}
	}
	if (bar.value != undefined){
		if (bar.value.chart != undefined){
			chart = bar.value.chart
		}
	}
	if (doughnut.value != undefined){
		if (doughnut.value.chart != undefined){
			chart = doughnut.value.chart
		}
	}
	if (chart){
		pieData.value.datasets[0].backgroundColor = backgroundColor
		chartOptions.value.color = legendColor
		chart.data.datasets[0].backgroundColor = backgroundColor;
		chart.options.color = legendColor
		chart.update()
	}
}
watch(colormode, updateColors)
watch(roomTopicName, ()=>{
	if (roomTopicName.value.length > 255){
		roomTopicName.value = roomTopicName.value.substring(0,255)
	}
})
</script>

<template>
	<PermenantHeader :inRoom="true" :roomId="currentRoom.id"></PermenantHeader>
	<div v-if="currentUser.permissions.host && currentRoom.status == HCRoomStatus.voting" class="flex flex-col lg:flex-row-reverse justify-center lg:gap-20 gap-10 mt-7 mx-7">
		<div class="flex flex-col lg:max-w-xl gap-5 xl:mr-8">
			<div class="flex justify-center items-center gap-5">
				<input v-model="roomTopicName" placeholder="Enter Story Name" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4">
				<svg v-if="currentRoom.topicName != roomTopicName" @click="socketSetTopicName()" mlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-floppy-fill cursor-pointer" viewBox="0 0 16 16">
					<path d="M0 1.5A1.5 1.5 0 0 1 1.5 0H3v5.5A1.5 1.5 0 0 0 4.5 7h7A1.5 1.5 0 0 0 13 5.5V0h.086a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5H14v-5.5A1.5 1.5 0 0 0 12.5 9h-9A1.5 1.5 0 0 0 2 10.5V16h-.5A1.5 1.5 0 0 1 0 14.5z"/>
					<path d="M3 16h10v-5.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5zm9-16H4v5.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5zM9 1h2v4H9z"/>
				</svg>
				
				<button @click="socketLeaveRoom" v-if="colormode.preference == 'dark'" class="hidden lg:inline z-50 fixed left-[100%] top-[100%] translate-x-[-150%] translate-y-[-150%]">
					<svg width="32" height="32" viewBox="0 0 89 89" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M28.9736 18.8756V37.7512L31.7432 40.4782L34.5128 43.2051V24.3721V5.53903H58.5867H82.6606V41.9695V78.3999H85.4302H88.1997V39.1999V-0.000100076H58.5867H28.9736V18.8756Z" fill="#F16523"/>
						<path d="M77.9739 8.18087C72.4773 9.2887 45.7191 14.9983 45.0799 15.1687C44.3556 15.3817 44.313 17.5122 44.313 51.8122C44.313 86.3252 44.3556 88.2426 45.0799 88.0296C45.4634 87.9017 51.7695 86.24 59.013 84.3652C66.2991 82.4478 74.0965 80.4026 76.3973 79.7635L80.5304 78.6983V43.4183C80.5304 24.0313 80.4026 8.05305 80.2321 7.96783C80.0191 7.88261 79.0391 7.96783 77.9739 8.18087Z" fill="#F16523"/>
						<path d="M17.0435 34.641V40.4784H8.52174H0V47.9349V55.3914H8.52174H17.0009L17.1287 61.1436L17.2565 66.8958L26.7583 57.4366L36.2174 47.9349L26.6304 38.3479L17.0435 28.761V34.641Z" fill="#F16523"/>
						<path d="M31.6154 55.519L28.9736 58.2034V68.3016V78.3999H31.7432H34.5128V65.6173C34.5128 58.5869 34.4702 52.8347 34.3849 52.8347C34.3423 52.8347 33.0641 54.0277 31.6154 55.519Z" fill="#F16523"/>
					</svg>
				</button>
				<button @click="socketLeaveRoom"  v-if="colormode.preference == 'light'" class="hidden lg:inline z-50 fixed left-[100%] top-[100%] translate-x-[-150%] translate-y-[-150%]">
					<svg width="32" height="32" viewBox="0 0 89 89" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M28.9736 18.8756V37.7512L31.7432 40.4782L34.5128 43.2051V24.3721V5.53903H58.5867H82.6606V41.9695V78.3999H85.4302H88.1997V39.1999V-0.000100076H58.5867H28.9736V18.8756Z" fill="#2255BE"/>
						<path d="M77.9739 8.18087C72.4773 9.2887 45.7191 14.9983 45.0799 15.1687C44.3556 15.3817 44.313 17.5122 44.313 51.8122C44.313 86.3252 44.3556 88.2426 45.0799 88.0296C45.4634 87.9017 51.7695 86.24 59.013 84.3652C66.2991 82.4478 74.0965 80.4026 76.3973 79.7635L80.5304 78.6983V43.4183C80.5304 24.0313 80.4026 8.05305 80.2321 7.96783C80.0191 7.88261 79.0391 7.96783 77.9739 8.18087Z" fill="#2255BE"/>
						<path d="M17.0435 34.641V40.4784H8.52174H0V47.9349V55.3914H8.52174H17.0009L17.1287 61.1436L17.2565 66.8958L26.7583 57.4366L36.2174 47.9349L26.6304 38.3479L17.0435 28.761V34.641Z" fill="#2255BE"/>
						<path d="M31.6154 55.519L28.9736 58.2034V68.3016V78.3999H31.7432H34.5128V65.6173C34.5128 58.5869 34.4702 52.8347 34.3849 52.8347C34.3423 52.8347 33.0641 54.0277 31.6154 55.519Z" fill="#2255BE"/>
					</svg>
				</button>
			</div>
			<div class="flex flex-row-reverse justify-between">
				<button @click="socketDisplayResults()" class="p-3 text-white dark:text-white text-base font-small rounded-md hover:text-blue-800 hover:bg-white dark:hover:bg-white dark:hover:text-orange-500 shadow bg-blue-800 dark:bg-orange-500 border border-blue-800 dark:border-orange-500">Reveal Votes</button>
			</div>

			<div class="grid grid-cols-4 grid-rows-3 gap-4 sm:grid-cols-7 sm:grid-rows-2">
					<div :id="cards[0]" @click="submitVote('0', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl select-none">0</p>
					</div>
					<div :id="cards[1]" @click="submitVote('1/2', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">1/2</p>
					</div>
					<div :id="cards[2]" @click="submitVote('1', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">1</p>
					</div>
					<div :id="cards[3]" @click="submitVote('2', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">2</p>
					</div>
					<div :id="cards[4]" @click="submitVote('3', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center"  style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">3</p>
					</div>
					<div :id="cards[5]" @click="submitVote('5', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center"  style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">5</p>
					</div>
					<div :id="cards[6]" @click="submitVote('8', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer  bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">8</p>
					</div>
					<div :id="cards[7]" @click="submitVote('13', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">13</p>
					</div>
					<div :id="cards[8]" @click="submitVote('20', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">20</p>
					</div>
					<div :id="cards[9]" @click="submitVote('40', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer  bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">40</p>
					</div>
					<div :id="cards[10]" @click="submitVote('100', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">100</p>
					</div>
					<div :id="cards[11]" @click="submitVote('?', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer  bg-gray-300 dark:bg-gray-700 rounded-full text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
						<p class="font-medium text-xl">?</p>
					</div>
					<div :id="cards[12]" @click="socketSetCoffeeBreak(true)" class="flex justify-center dark:hover:bg-orange-500 hover:bg-blue-800 bg-gray-300 dark:bg-gray-700 rounded-full cursor-pointer w-2/3 sm:w-full col-span-4 sm:col-span-2">
						<svg v-if="colormode.preference == 'dark'" class="w-1/4" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M9.35565 17.7754H13.5137C14.8922 17.7754 16.2142 17.2246 17.1889 16.2441C18.1636 15.2637 18.7112 13.9339 18.7112 12.5473V11.5017H19.7507C20.5778 11.5017 21.371 11.1712 21.9559 10.5829C22.5407 9.99465 22.8692 9.19678 22.8692 8.36483C22.8692 7.53288 22.5407 6.73501 21.9559 6.14673C21.371 5.55845 20.5778 5.22796 19.7507 5.22796H18.7112V4.18234C18.7112 3.90502 18.6017 3.63907 18.4068 3.44297C18.2118 3.24688 17.9474 3.13672 17.6717 3.13672H5.19762C4.92193 3.13672 4.65753 3.24688 4.46258 3.44297C4.26764 3.63907 4.15812 3.90502 4.15812 4.18234V12.5473C4.15812 13.9339 4.70571 15.2637 5.68044 16.2441C6.65517 17.2246 7.97718 17.7754 9.35565 17.7754ZM18.7112 7.31921H19.7507C20.0264 7.31921 20.2908 7.42937 20.4858 7.62546C20.6807 7.82155 20.7902 8.08751 20.7902 8.36483C20.7902 8.64214 20.6807 8.9081 20.4858 9.10419C20.2908 9.30029 20.0264 9.41045 19.7507 9.41045H18.7112V7.31921ZM6.23713 5.22796H16.6322V12.5473C16.6322 13.3793 16.3036 14.1771 15.7188 14.7654C15.134 15.3537 14.3408 15.6842 13.5137 15.6842H9.35565C8.52857 15.6842 7.73536 15.3537 7.15052 14.7654C6.56569 14.1771 6.23713 13.3793 6.23713 12.5473V5.22796ZM21.8297 19.8667H3.11861C2.84291 19.8667 2.57851 19.9768 2.38357 20.1729C2.18862 20.369 2.0791 20.635 2.0791 20.9123C2.0791 21.1896 2.18862 21.4556 2.38357 21.6517C2.57851 21.8477 2.84291 21.9579 3.11861 21.9579H21.8297C22.1054 21.9579 22.3698 21.8477 22.5648 21.6517C22.7597 21.4556 22.8692 21.1896 22.8692 20.9123C22.8692 20.635 22.7597 20.369 22.5648 20.1729C22.3698 19.9768 22.1054 19.8667 21.8297 19.8667Z" fill="#F7F8F9"/>
						</svg>
						<svg v-else class="w-1/4" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M9.35565 17.7754H13.5137C14.8922 17.7754 16.2142 17.2246 17.1889 16.2441C18.1636 15.2637 18.7112 13.9339 18.7112 12.5473V11.5017H19.7507C20.5778 11.5017 21.371 11.1712 21.9559 10.5829C22.5407 9.99465 22.8692 9.19678 22.8692 8.36483C22.8692 7.53288 22.5407 6.73501 21.9559 6.14673C21.371 5.55845 20.5778 5.22796 19.7507 5.22796H18.7112V4.18234C18.7112 3.90502 18.6017 3.63907 18.4068 3.44297C18.2118 3.24688 17.9474 3.13672 17.6717 3.13672H5.19762C4.92193 3.13672 4.65753 3.24688 4.46258 3.44297C4.26764 3.63907 4.15812 3.90502 4.15812 4.18234V12.5473C4.15812 13.9339 4.70571 15.2637 5.68044 16.2441C6.65517 17.2246 7.97718 17.7754 9.35565 17.7754ZM18.7112 7.31921H19.7507C20.0264 7.31921 20.2908 7.42937 20.4858 7.62546C20.6807 7.82155 20.7902 8.08751 20.7902 8.36483C20.7902 8.64214 20.6807 8.9081 20.4858 9.10419C20.2908 9.30029 20.0264 9.41045 19.7507 9.41045H18.7112V7.31921ZM6.23713 5.22796H16.6322V12.5473C16.6322 13.3793 16.3036 14.1771 15.7188 14.7654C15.134 15.3537 14.3408 15.6842 13.5137 15.6842H9.35565C8.52857 15.6842 7.73536 15.3537 7.15052 14.7654C6.56569 14.1771 6.23713 13.3793 6.23713 12.5473V5.22796ZM21.8297 19.8667H3.11861C2.84291 19.8667 2.57851 19.9768 2.38357 20.1729C2.18862 20.369 2.0791 20.635 2.0791 20.9123C2.0791 21.1896 2.18862 21.4556 2.38357 21.6517C2.57851 21.8477 2.84291 21.9579 3.11861 21.9579H21.8297C22.1054 21.9579 22.3698 21.8477 22.5648 21.6517C22.7597 21.4556 22.8692 21.1896 22.8692 20.9123C22.8692 20.635 22.7597 20.369 22.5648 20.1729C22.3698 19.9768 22.1054 19.8667 21.8297 19.8667Z" fill="#000000"/>
						</svg>
					</div>
			</div>
		</div>
		<div class="flex flex-col gap-5 lg:w-full xl:max-w-2xl" style="max-height: 800px;">
			<div class="flex justify-between gap-5" v-if="currentRoom.status == 0 && currentRoom.roomCounterEnabled">
				<div class="w-full h-[46px] bg-gray-300 dark:bg-gray-700 rounded-md flex justify-center">
					<input v-model="minutes" type="number"
						class="w-12 h-12 text-center bg-transparent text-black dark:text-gray-50 text-2xl font-light rounded-md pl-2 pr-2">
					<p class="w-fit h-fit text-[30px] pl-2 pr-2 text-black dark:text-gray-50">:</p>
					<input v-model="seconds" type="number"
						class="w-12 h-12 text-center bg-transparent text-black dark:text-gray-50 text-2xl font-light rounded-md pl-2 pr-2">
				</div>
				<button @click="socketStartCount()" v-if="!currentRoom.counter.active" class="p-2 text-blue-800 hover:text-white hover:bg-blue-800 dark:hover:bg-orange-500 dark:hover:text-white dark:text-orange-500 text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 whitespace-nowrap">
					<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</button>
				<button @click="socketCancelCount()" v-if="currentRoom.counter.active" class="p-2 text-blue-800 hover:text-white hover:bg-blue-800 dark:hover:bg-orange-500 dark:hover:text-white dark:text-orange-500 text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 whitespace-nowrap">
					<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" class="bi bi-stop-circle-fill" viewBox="0 0 16 16">
						<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M6.5 5A1.5 1.5 0 0 0 5 6.5v3A1.5 1.5 0 0 0 6.5 11h3A1.5 1.5 0 0 0 11 9.5v-3A1.5 1.5 0 0 0 9.5 5z"/>
					</svg> 
				</button>
				<button @click="socketStopCount()" v-if="currentRoom.counter.active" class="p-2 text-blue-800 hover:text-white hover:bg-blue-800 dark:hover:bg-orange-500 dark:hover:text-white dark:text-orange-500 text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 whitespace-nowrap">
					<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
						<path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/>
					</svg> 
				</button>
			</div>
			<div class="bg-gray-300 dark:bg-gray-700 rounded-2xl overflow-auto">
				<div class="flex justify-between pt-5 pl-16 pr-16">
					<p class="font-bold text-black dark:text-gray-300">Name</p>
					<p class="font-bold text-black dark:text-gray-300">Status</p>
				</div>
				<div class="border-slate-400 border-t-2 mt-5 pt-6 pb-6 flex flex-col gap-2">
					<roomMemberDisplayItem v-for="member in currentRoomMembers" :user-id=userId :room-status=currentRoom.status :member=member :lowest-vote="lowestVote" :highest-vote="highestVote"></roomMemberDisplayItem>
				</div>
			</div>
			<div class="bg-transparent rounded-2xl flex w-full items-center gap-5">
				<input v-if="currentRoom.urlName == ''" v-model="roomUrlName" placeholder="Enter Story URL" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4">
				<a v-else @click="confirmHyperlink(currentRoom.urlName)" target="_blank" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4 underline cursor-pointer truncate">
					{{ currentRoom.urlName }}
				</a>
				<svg v-if="currentRoom.urlName != roomUrlName" @click="socketSetUrl()" mlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-floppy-fill cursor-pointer" viewBox="0 0 16 16">
					<path d="M0 1.5A1.5 1.5 0 0 1 1.5 0H3v5.5A1.5 1.5 0 0 0 4.5 7h7A1.5 1.5 0 0 0 13 5.5V0h.086a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5H14v-5.5A1.5 1.5 0 0 0 12.5 9h-9A1.5 1.5 0 0 0 2 10.5V16h-.5A1.5 1.5 0 0 1 0 14.5z"/>
					<path d="M3 16h10v-5.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5zm9-16H4v5.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5zM9 1h2v4H9z"/>
				</svg>
				<button v-else-if="currentRoom.urlName != ''" @click="roomUrlName = ''; socketSetUrl()" class="text-black dark:text-white text-xl">✕</button>
			</div>
			<div class="bg-gray-300 dark:bg-gray-700 rounded-2xl flex p-4 w-full justify-between">
				<p class="">{{roomLink}}</p>
				<div v-if="!copied">
					<svg @click="copy()" class="cursor-pointer" v-if="colormode.preference == 'dark'" width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M18 6.96558C17.9896 6.87448 17.9695 6.78473 17.94 6.69784V6.60859C17.8919 6.50662 17.8278 6.4129 17.75 6.33092L11.75 0.380993C11.6673 0.303858 11.5728 0.240258 11.47 0.192578C11.4402 0.188374 11.4099 0.188374 11.38 0.192578C11.2784 0.134806 11.1662 0.0977206 11.05 0.0834961H7C6.20435 0.0834961 5.44129 0.396929 4.87868 0.954843C4.31607 1.51276 4 2.26945 4 3.05846V4.05012H3C2.20435 4.05012 1.44129 4.36355 0.87868 4.92146C0.316071 5.47938 0 6.23607 0 7.02508V16.9416C0 17.7306 0.316071 18.4873 0.87868 19.0452C1.44129 19.6032 2.20435 19.9166 3 19.9166H11C11.7956 19.9166 12.5587 19.6032 13.1213 19.0452C13.6839 18.4873 14 17.7306 14 16.9416V15.95H15C15.7956 15.95 16.5587 15.6365 17.1213 15.0786C17.6839 14.5207 18 13.764 18 12.975V7.02508C18 7.02508 18 7.02508 18 6.96558ZM12 3.46504L14.59 6.03343H13C12.7348 6.03343 12.4804 5.92895 12.2929 5.74298C12.1054 5.55701 12 5.30477 12 5.04177V3.46504ZM12 16.9416C12 17.2046 11.8946 17.4569 11.7071 17.6428C11.5196 17.8288 11.2652 17.9333 11 17.9333H3C2.73478 17.9333 2.48043 17.8288 2.29289 17.6428C2.10536 17.4569 2 17.2046 2 16.9416V7.02508C2 6.76208 2.10536 6.50985 2.29289 6.32388C2.48043 6.1379 2.73478 6.03343 3 6.03343H4V12.975C4 13.764 4.31607 14.5207 4.87868 15.0786C5.44129 15.6365 6.20435 15.95 7 15.95H12V16.9416ZM16 12.975C16 13.238 15.8946 13.4902 15.7071 13.6762C15.5196 13.8622 15.2652 13.9667 15 13.9667H7C6.73478 13.9667 6.48043 13.8622 6.29289 13.6762C6.10536 13.4902 6 13.238 6 12.975V3.05846C6 2.79546 6.10536 2.54323 6.29289 2.35726C6.48043 2.17128 6.73478 2.06681 7 2.06681H10V5.04177C10 5.83078 10.3161 6.58748 10.8787 7.14539C11.4413 7.7033 12.2044 8.01674 13 8.01674H16V12.975Z" fill="white"/>
					</svg>
					<svg @click="copy()" class="cursor-pointer" v-else-if="colormode.preference == 'dark'" width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M18 6.96558C17.9896 6.87448 17.9695 6.78473 17.94 6.69784V6.60859C17.8919 6.50662 17.8278 6.4129 17.75 6.33092L11.75 0.380993C11.6673 0.303858 11.5728 0.240258 11.47 0.192578C11.4402 0.188374 11.4099 0.188374 11.38 0.192578C11.2784 0.134806 11.1662 0.0977206 11.05 0.0834961H7C6.20435 0.0834961 5.44129 0.396929 4.87868 0.954843C4.31607 1.51276 4 2.26945 4 3.05846V4.05012H3C2.20435 4.05012 1.44129 4.36355 0.87868 4.92146C0.316071 5.47938 0 6.23607 0 7.02508V16.9416C0 17.7306 0.316071 18.4873 0.87868 19.0452C1.44129 19.6032 2.20435 19.9166 3 19.9166H11C11.7956 19.9166 12.5587 19.6032 13.1213 19.0452C13.6839 18.4873 14 17.7306 14 16.9416V15.95H15C15.7956 15.95 16.5587 15.6365 17.1213 15.0786C17.6839 14.5207 18 13.764 18 12.975V7.02508C18 7.02508 18 7.02508 18 6.96558ZM12 3.46504L14.59 6.03343H13C12.7348 6.03343 12.4804 5.92895 12.2929 5.74298C12.1054 5.55701 12 5.30477 12 5.04177V3.46504ZM12 16.9416C12 17.2046 11.8946 17.4569 11.7071 17.6428C11.5196 17.8288 11.2652 17.9333 11 17.9333H3C2.73478 17.9333 2.48043 17.8288 2.29289 17.6428C2.10536 17.4569 2 17.2046 2 16.9416V7.02508C2 6.76208 2.10536 6.50985 2.29289 6.32388C2.48043 6.1379 2.73478 6.03343 3 6.03343H4V12.975C4 13.764 4.31607 14.5207 4.87868 15.0786C5.44129 15.6365 6.20435 15.95 7 15.95H12V16.9416ZM16 12.975C16 13.238 15.8946 13.4902 15.7071 13.6762C15.5196 13.8622 15.2652 13.9667 15 13.9667H7C6.73478 13.9667 6.48043 13.8622 6.29289 13.6762C6.10536 13.4902 6 13.238 6 12.975V3.05846C6 2.79546 6.10536 2.54323 6.29289 2.35726C6.48043 2.17128 6.73478 2.06681 7 2.06681H10V5.04177C10 5.83078 10.3161 6.58748 10.8787 7.14539C11.4413 7.7033 12.2044 8.01674 13 8.01674H16V12.975Z" fill="black"/>
					</svg>
				</div>
				<div v-else class="cursor-pointer">
					<p>✅</p>
				</div>
			</div>
		</div>
	</div>

	<div v-if="!currentUser.permissions.host && currentRoom.status == HCRoomStatus.voting" class="flex flex-col lg:flex-row-reverse justify-center lg:gap-10 gap-10 mt-7 mx-7">
		<div v-if="currentUser.userVotingStatus != HCVotingStatus.spectating" class="flex flex-col lg:max-w-xl gap-5 justify-center xl:mr-8">
			<div class="flex justify-center items-center gap-5">
				<input v-model="roomTopicName" disabled placeholder="Story Name" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4">
				<button @click="socketLeaveRoom" v-if="colormode.preference == 'dark'" class="lg:z-50 lg:fixed lg:left-[100%] lg:top-[100%] lg:translate-x-[-150%] lg:translate-y-[-150%]">
					<svg width="32" height="32" viewBox="0 0 89 89" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M28.9736 18.8756V37.7512L31.7432 40.4782L34.5128 43.2051V24.3721V5.53903H58.5867H82.6606V41.9695V78.3999H85.4302H88.1997V39.1999V-0.000100076H58.5867H28.9736V18.8756Z" fill="#F16523"/>
						<path d="M77.9739 8.18087C72.4773 9.2887 45.7191 14.9983 45.0799 15.1687C44.3556 15.3817 44.313 17.5122 44.313 51.8122C44.313 86.3252 44.3556 88.2426 45.0799 88.0296C45.4634 87.9017 51.7695 86.24 59.013 84.3652C66.2991 82.4478 74.0965 80.4026 76.3973 79.7635L80.5304 78.6983V43.4183C80.5304 24.0313 80.4026 8.05305 80.2321 7.96783C80.0191 7.88261 79.0391 7.96783 77.9739 8.18087Z" fill="#F16523"/>
						<path d="M17.0435 34.641V40.4784H8.52174H0V47.9349V55.3914H8.52174H17.0009L17.1287 61.1436L17.2565 66.8958L26.7583 57.4366L36.2174 47.9349L26.6304 38.3479L17.0435 28.761V34.641Z" fill="#F16523"/>
						<path d="M31.6154 55.519L28.9736 58.2034V68.3016V78.3999H31.7432H34.5128V65.6173C34.5128 58.5869 34.4702 52.8347 34.3849 52.8347C34.3423 52.8347 33.0641 54.0277 31.6154 55.519Z" fill="#F16523"/>
					</svg>
				</button>
				<button @click="socketLeaveRoom"  v-if="colormode.preference == 'light'" class="lg:z-50 lg:fixed lg:left-[100%] lg:top-[100%] lg:translate-x-[-150%] lg:translate-y-[-150%]">
					<svg width="32" height="32" viewBox="0 0 89 89" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M28.9736 18.8756V37.7512L31.7432 40.4782L34.5128 43.2051V24.3721V5.53903H58.5867H82.6606V41.9695V78.3999H85.4302H88.1997V39.1999V-0.000100076H58.5867H28.9736V18.8756Z" fill="#2255BE"/>
						<path d="M77.9739 8.18087C72.4773 9.2887 45.7191 14.9983 45.0799 15.1687C44.3556 15.3817 44.313 17.5122 44.313 51.8122C44.313 86.3252 44.3556 88.2426 45.0799 88.0296C45.4634 87.9017 51.7695 86.24 59.013 84.3652C66.2991 82.4478 74.0965 80.4026 76.3973 79.7635L80.5304 78.6983V43.4183C80.5304 24.0313 80.4026 8.05305 80.2321 7.96783C80.0191 7.88261 79.0391 7.96783 77.9739 8.18087Z" fill="#2255BE"/>
						<path d="M17.0435 34.641V40.4784H8.52174H0V47.9349V55.3914H8.52174H17.0009L17.1287 61.1436L17.2565 66.8958L26.7583 57.4366L36.2174 47.9349L26.6304 38.3479L17.0435 28.761V34.641Z" fill="#2255BE"/>
						<path d="M31.6154 55.519L28.9736 58.2034V68.3016V78.3999H31.7432H34.5128V65.6173C34.5128 58.5869 34.4702 52.8347 34.3849 52.8347C34.3423 52.8347 33.0641 54.0277 31.6154 55.519Z" fill="#2255BE"/>
					</svg>
				</button>
			</div>
			<div class="grid grid-cols-4 grid-rows-3 xl:grid-cols-5 xl:grid-rows-3 lg:grid-rows-4 lg:grid-cols-4 lg:gap-10 gap-4 sm:grid-cols-7 sm:grid-rows-2">
				<div :id="cards[0]" @click="submitVote('0', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl select-none">0</p>
				</div>
				<div :id="cards[1]" @click="submitVote('1/2', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">1/2</p>
				</div>
				<div :id="cards[2]" @click="submitVote('1', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">1</p>
				</div>
				<div :id="cards[3]" @click="submitVote('2', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">2</p>
				</div>
				<div :id="cards[4]" @click="submitVote('3', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center"  style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">3</p>
				</div>
				<div :id="cards[5]" @click="submitVote('5', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center"  style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">5</p>
				</div>
				<div :id="cards[6]" @click="submitVote('8', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer  bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">8</p>
				</div>
				<div :id="cards[7]" @click="submitVote('13', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">13</p>
				</div>
				<div :id="cards[8]" @click="submitVote('20', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">20</p>
				</div>
				<div :id="cards[9]" @click="submitVote('40', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer  bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">40</p>
				</div>
				<div :id="cards[10]" @click="submitVote('100', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">100</p>
				</div>
				<div :id="cards[11]" @click="submitVote('?', $event)" class="text-black dark:text-gray-300 dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer  bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center flex justify-center items-center" style="aspect-ratio: 1/1;">
					<p class="font-medium text-xl">?</p>
				</div>
				<div class="align-items xl:col-span-1 xl:w-[102px] xl:h-[171px] lg:col-span-4 col-span-2 flex justify-center">
					<div @click="submitVote('Coffee Break', $event)" :id="cards[12]"  class="flex dark:hover:bg-orange-500 hover:bg-blue-800 hover:text-gray-300 w-full cursor-pointer  bg-gray-300 dark:bg-gray-700 rounded-full lg:w-[102px] lg:h-[171px] lg:rounded-lg text-center justify-center items-center">
						<svg v-if="colormode.preference == 'dark'" class="w-1/4" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M9.35565 17.7754H13.5137C14.8922 17.7754 16.2142 17.2246 17.1889 16.2441C18.1636 15.2637 18.7112 13.9339 18.7112 12.5473V11.5017H19.7507C20.5778 11.5017 21.371 11.1712 21.9559 10.5829C22.5407 9.99465 22.8692 9.19678 22.8692 8.36483C22.8692 7.53288 22.5407 6.73501 21.9559 6.14673C21.371 5.55845 20.5778 5.22796 19.7507 5.22796H18.7112V4.18234C18.7112 3.90502 18.6017 3.63907 18.4068 3.44297C18.2118 3.24688 17.9474 3.13672 17.6717 3.13672H5.19762C4.92193 3.13672 4.65753 3.24688 4.46258 3.44297C4.26764 3.63907 4.15812 3.90502 4.15812 4.18234V12.5473C4.15812 13.9339 4.70571 15.2637 5.68044 16.2441C6.65517 17.2246 7.97718 17.7754 9.35565 17.7754ZM18.7112 7.31921H19.7507C20.0264 7.31921 20.2908 7.42937 20.4858 7.62546C20.6807 7.82155 20.7902 8.08751 20.7902 8.36483C20.7902 8.64214 20.6807 8.9081 20.4858 9.10419C20.2908 9.30029 20.0264 9.41045 19.7507 9.41045H18.7112V7.31921ZM6.23713 5.22796H16.6322V12.5473C16.6322 13.3793 16.3036 14.1771 15.7188 14.7654C15.134 15.3537 14.3408 15.6842 13.5137 15.6842H9.35565C8.52857 15.6842 7.73536 15.3537 7.15052 14.7654C6.56569 14.1771 6.23713 13.3793 6.23713 12.5473V5.22796ZM21.8297 19.8667H3.11861C2.84291 19.8667 2.57851 19.9768 2.38357 20.1729C2.18862 20.369 2.0791 20.635 2.0791 20.9123C2.0791 21.1896 2.18862 21.4556 2.38357 21.6517C2.57851 21.8477 2.84291 21.9579 3.11861 21.9579H21.8297C22.1054 21.9579 22.3698 21.8477 22.5648 21.6517C22.7597 21.4556 22.8692 21.1896 22.8692 20.9123C22.8692 20.635 22.7597 20.369 22.5648 20.1729C22.3698 19.9768 22.1054 19.8667 21.8297 19.8667Z" fill="#F7F8F9"/>
						</svg>
						<svg v-else class="w-1/4" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M9.35565 17.7754H13.5137C14.8922 17.7754 16.2142 17.2246 17.1889 16.2441C18.1636 15.2637 18.7112 13.9339 18.7112 12.5473V11.5017H19.7507C20.5778 11.5017 21.371 11.1712 21.9559 10.5829C22.5407 9.99465 22.8692 9.19678 22.8692 8.36483C22.8692 7.53288 22.5407 6.73501 21.9559 6.14673C21.371 5.55845 20.5778 5.22796 19.7507 5.22796H18.7112V4.18234C18.7112 3.90502 18.6017 3.63907 18.4068 3.44297C18.2118 3.24688 17.9474 3.13672 17.6717 3.13672H5.19762C4.92193 3.13672 4.65753 3.24688 4.46258 3.44297C4.26764 3.63907 4.15812 3.90502 4.15812 4.18234V12.5473C4.15812 13.9339 4.70571 15.2637 5.68044 16.2441C6.65517 17.2246 7.97718 17.7754 9.35565 17.7754ZM18.7112 7.31921H19.7507C20.0264 7.31921 20.2908 7.42937 20.4858 7.62546C20.6807 7.82155 20.7902 8.08751 20.7902 8.36483C20.7902 8.64214 20.6807 8.9081 20.4858 9.10419C20.2908 9.30029 20.0264 9.41045 19.7507 9.41045H18.7112V7.31921ZM6.23713 5.22796H16.6322V12.5473C16.6322 13.3793 16.3036 14.1771 15.7188 14.7654C15.134 15.3537 14.3408 15.6842 13.5137 15.6842H9.35565C8.52857 15.6842 7.73536 15.3537 7.15052 14.7654C6.56569 14.1771 6.23713 13.3793 6.23713 12.5473V5.22796ZM21.8297 19.8667H3.11861C2.84291 19.8667 2.57851 19.9768 2.38357 20.1729C2.18862 20.369 2.0791 20.635 2.0791 20.9123C2.0791 21.1896 2.18862 21.4556 2.38357 21.6517C2.57851 21.8477 2.84291 21.9579 3.11861 21.9579H21.8297C22.1054 21.9579 22.3698 21.8477 22.5648 21.6517C22.7597 21.4556 22.8692 21.1896 22.8692 20.9123C22.8692 20.635 22.7597 20.369 22.5648 20.1729C22.3698 19.9768 22.1054 19.8667 21.8297 19.8667Z" fill="#000000"/>
						</svg>
					</div>
				</div>
			</div>
		</div>
		<div class="flex flex-col gap-5 lg:w-1/3 xl:max-w-2xl">
			<div class="flex justify-between gap-5" v-if="currentRoom.status == 0 && currentRoom.roomCounterEnabled">
				<div class="w-full h-[46px] bg-gray-300 dark:bg-gray-700 rounded-md flex justify-center">
					<input disabled v-model="minutes" type="number"
					class="w-12 h-12 text-center bg-transparent text-black dark:text-gray-50 text-2xl font-light rounded-md pl-2 pr-2">
					<p class="w-fit h-fit text-[30px] pl-2 pr-2 text-black dark:text-gray-50">:</p>
					<input disabled v-model="seconds" type="number"
					class="w-12 h-12 text-center bg-transparent text-black dark:text-gray-50 text-2xl font-light rounded-md pl-2 pr-2">
				</div>
			</div>
			<div class="bg-gray-300 dark:bg-gray-700 rounded-2xl">
				<div class="flex justify-between pt-5 pl-16 pr-16">
					<p class="font-bold text-black dark:text-gray-300">Name</p>
					<p class="font-bold text-black dark:text-gray-300">Status</p>
				</div>
				<div class="border-slate-400 border-t-2 mt-5 pt-6 pb-6 flex flex-col gap-2">
					<roomMemberDisplayItem v-for="member in currentRoomMembers" :user-id=userId :room-status=currentRoom.status :member=member :lowest-vote="lowestVote" :highest-vote="highestVote"></roomMemberDisplayItem>
				</div>
			</div>
			<input v-if="currentRoom.urlName == ''" disabled placeholder="URL" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4">
			<a v-else @click="confirmHyperlink(currentRoom.urlName)" target="_blank" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4 underline cursor-pointer truncate">
				{{ currentRoom.urlName }}
			</a>
			<div class="bg-gray-300 dark:bg-gray-700 rounded-2xl flex p-4 w-full justify-between">
				<p class="">{{roomLink}}</p>
				<div v-if="!copied">
					<svg @click="copy()" class="cursor-pointer" v-if="colormode.preference == 'dark'" width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M18 6.96558C17.9896 6.87448 17.9695 6.78473 17.94 6.69784V6.60859C17.8919 6.50662 17.8278 6.4129 17.75 6.33092L11.75 0.380993C11.6673 0.303858 11.5728 0.240258 11.47 0.192578C11.4402 0.188374 11.4099 0.188374 11.38 0.192578C11.2784 0.134806 11.1662 0.0977206 11.05 0.0834961H7C6.20435 0.0834961 5.44129 0.396929 4.87868 0.954843C4.31607 1.51276 4 2.26945 4 3.05846V4.05012H3C2.20435 4.05012 1.44129 4.36355 0.87868 4.92146C0.316071 5.47938 0 6.23607 0 7.02508V16.9416C0 17.7306 0.316071 18.4873 0.87868 19.0452C1.44129 19.6032 2.20435 19.9166 3 19.9166H11C11.7956 19.9166 12.5587 19.6032 13.1213 19.0452C13.6839 18.4873 14 17.7306 14 16.9416V15.95H15C15.7956 15.95 16.5587 15.6365 17.1213 15.0786C17.6839 14.5207 18 13.764 18 12.975V7.02508C18 7.02508 18 7.02508 18 6.96558ZM12 3.46504L14.59 6.03343H13C12.7348 6.03343 12.4804 5.92895 12.2929 5.74298C12.1054 5.55701 12 5.30477 12 5.04177V3.46504ZM12 16.9416C12 17.2046 11.8946 17.4569 11.7071 17.6428C11.5196 17.8288 11.2652 17.9333 11 17.9333H3C2.73478 17.9333 2.48043 17.8288 2.29289 17.6428C2.10536 17.4569 2 17.2046 2 16.9416V7.02508C2 6.76208 2.10536 6.50985 2.29289 6.32388C2.48043 6.1379 2.73478 6.03343 3 6.03343H4V12.975C4 13.764 4.31607 14.5207 4.87868 15.0786C5.44129 15.6365 6.20435 15.95 7 15.95H12V16.9416ZM16 12.975C16 13.238 15.8946 13.4902 15.7071 13.6762C15.5196 13.8622 15.2652 13.9667 15 13.9667H7C6.73478 13.9667 6.48043 13.8622 6.29289 13.6762C6.10536 13.4902 6 13.238 6 12.975V3.05846C6 2.79546 6.10536 2.54323 6.29289 2.35726C6.48043 2.17128 6.73478 2.06681 7 2.06681H10V5.04177C10 5.83078 10.3161 6.58748 10.8787 7.14539C11.4413 7.7033 12.2044 8.01674 13 8.01674H16V12.975Z" fill="white"/>
					</svg>
					<svg @click="copy()" class="cursor-pointer" v-else-if="colormode.preference == 'dark'" width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M18 6.96558C17.9896 6.87448 17.9695 6.78473 17.94 6.69784V6.60859C17.8919 6.50662 17.8278 6.4129 17.75 6.33092L11.75 0.380993C11.6673 0.303858 11.5728 0.240258 11.47 0.192578C11.4402 0.188374 11.4099 0.188374 11.38 0.192578C11.2784 0.134806 11.1662 0.0977206 11.05 0.0834961H7C6.20435 0.0834961 5.44129 0.396929 4.87868 0.954843C4.31607 1.51276 4 2.26945 4 3.05846V4.05012H3C2.20435 4.05012 1.44129 4.36355 0.87868 4.92146C0.316071 5.47938 0 6.23607 0 7.02508V16.9416C0 17.7306 0.316071 18.4873 0.87868 19.0452C1.44129 19.6032 2.20435 19.9166 3 19.9166H11C11.7956 19.9166 12.5587 19.6032 13.1213 19.0452C13.6839 18.4873 14 17.7306 14 16.9416V15.95H15C15.7956 15.95 16.5587 15.6365 17.1213 15.0786C17.6839 14.5207 18 13.764 18 12.975V7.02508C18 7.02508 18 7.02508 18 6.96558ZM12 3.46504L14.59 6.03343H13C12.7348 6.03343 12.4804 5.92895 12.2929 5.74298C12.1054 5.55701 12 5.30477 12 5.04177V3.46504ZM12 16.9416C12 17.2046 11.8946 17.4569 11.7071 17.6428C11.5196 17.8288 11.2652 17.9333 11 17.9333H3C2.73478 17.9333 2.48043 17.8288 2.29289 17.6428C2.10536 17.4569 2 17.2046 2 16.9416V7.02508C2 6.76208 2.10536 6.50985 2.29289 6.32388C2.48043 6.1379 2.73478 6.03343 3 6.03343H4V12.975C4 13.764 4.31607 14.5207 4.87868 15.0786C5.44129 15.6365 6.20435 15.95 7 15.95H12V16.9416ZM16 12.975C16 13.238 15.8946 13.4902 15.7071 13.6762C15.5196 13.8622 15.2652 13.9667 15 13.9667H7C6.73478 13.9667 6.48043 13.8622 6.29289 13.6762C6.10536 13.4902 6 13.238 6 12.975V3.05846C6 2.79546 6.10536 2.54323 6.29289 2.35726C6.48043 2.17128 6.73478 2.06681 7 2.06681H10V5.04177C10 5.83078 10.3161 6.58748 10.8787 7.14539C11.4413 7.7033 12.2044 8.01674 13 8.01674H16V12.975Z" fill="black"/>
					</svg>
				</div>
				<div v-else class="cursor-pointer">
					<p>✅</p>
				</div>
			</div>
		</div>
	</div>

	<div v-if="currentRoom.status == HCRoomStatus.reviewing" class="flex flex-col xl:flex-row-reverse justify-center xl:gap-20 gap-10 mt-7 mx-7">
		<button @click="socketLeaveRoom" v-if="colormode.preference == 'dark'" class="hidden lg:inline z-50 fixed left-[100%] top-[100%] translate-x-[-150%] translate-y-[-150%]">
			<svg width="32" height="32" viewBox="0 0 89 89" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M28.9736 18.8756V37.7512L31.7432 40.4782L34.5128 43.2051V24.3721V5.53903H58.5867H82.6606V41.9695V78.3999H85.4302H88.1997V39.1999V-0.000100076H58.5867H28.9736V18.8756Z" fill="#F16523"/>
				<path d="M77.9739 8.18087C72.4773 9.2887 45.7191 14.9983 45.0799 15.1687C44.3556 15.3817 44.313 17.5122 44.313 51.8122C44.313 86.3252 44.3556 88.2426 45.0799 88.0296C45.4634 87.9017 51.7695 86.24 59.013 84.3652C66.2991 82.4478 74.0965 80.4026 76.3973 79.7635L80.5304 78.6983V43.4183C80.5304 24.0313 80.4026 8.05305 80.2321 7.96783C80.0191 7.88261 79.0391 7.96783 77.9739 8.18087Z" fill="#F16523"/>
				<path d="M17.0435 34.641V40.4784H8.52174H0V47.9349V55.3914H8.52174H17.0009L17.1287 61.1436L17.2565 66.8958L26.7583 57.4366L36.2174 47.9349L26.6304 38.3479L17.0435 28.761V34.641Z" fill="#F16523"/>
				<path d="M31.6154 55.519L28.9736 58.2034V68.3016V78.3999H31.7432H34.5128V65.6173C34.5128 58.5869 34.4702 52.8347 34.3849 52.8347C34.3423 52.8347 33.0641 54.0277 31.6154 55.519Z" fill="#F16523"/>
			</svg>
		</button>
		<button @click="socketLeaveRoom"  v-if="colormode.preference == 'light'" class="hidden lg:inline lg:z-50 lg:fixed lg:left-[100%] lg:top-[100%] lg:translate-x-[-150%] lg:translate-y-[-150%]">
			<svg width="32" height="32" viewBox="0 0 89 89" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M28.9736 18.8756V37.7512L31.7432 40.4782L34.5128 43.2051V24.3721V5.53903H58.5867H82.6606V41.9695V78.3999H85.4302H88.1997V39.1999V-0.000100076H58.5867H28.9736V18.8756Z" fill="#2255BE"/>
				<path d="M77.9739 8.18087C72.4773 9.2887 45.7191 14.9983 45.0799 15.1687C44.3556 15.3817 44.313 17.5122 44.313 51.8122C44.313 86.3252 44.3556 88.2426 45.0799 88.0296C45.4634 87.9017 51.7695 86.24 59.013 84.3652C66.2991 82.4478 74.0965 80.4026 76.3973 79.7635L80.5304 78.6983V43.4183C80.5304 24.0313 80.4026 8.05305 80.2321 7.96783C80.0191 7.88261 79.0391 7.96783 77.9739 8.18087Z" fill="#2255BE"/>
				<path d="M17.0435 34.641V40.4784H8.52174H0V47.9349V55.3914H8.52174H17.0009L17.1287 61.1436L17.2565 66.8958L26.7583 57.4366L36.2174 47.9349L26.6304 38.3479L17.0435 28.761V34.641Z" fill="#2255BE"/>
				<path d="M31.6154 55.519L28.9736 58.2034V68.3016V78.3999H31.7432H34.5128V65.6173C34.5128 58.5869 34.4702 52.8347 34.3849 52.8347C34.3423 52.8347 33.0641 54.0277 31.6154 55.519Z" fill="#2255BE"/>
			</svg>
		</button>
		
		<div class="flex flex-col gap-5 xl:w-1/3">
			<div class="flex justify-center gap-5">
				<input v-on:keyup.enter="socketSetTopicName" maxlength="255" v-model="roomTopicName" :disabled="!currentUser.permissions.host" :placeholder="currentUser.permissions.host ? 'Enter Story Name' : 'Story Name'" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4">
				<svg v-if="currentRoom.topicName != roomTopicName" @click="socketSetTopicName()" mlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-floppy-fill cursor-pointer mt-3" viewBox="0 0 16 16">
					<path d="M0 1.5A1.5 1.5 0 0 1 1.5 0H3v5.5A1.5 1.5 0 0 0 4.5 7h7A1.5 1.5 0 0 0 13 5.5V0h.086a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5H14v-5.5A1.5 1.5 0 0 0 12.5 9h-9A1.5 1.5 0 0 0 2 10.5V16h-.5A1.5 1.5 0 0 1 0 14.5z"/>
					<path d="M3 16h10v-5.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5zm9-16H4v5.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5zM9 1h2v4H9z"/>
				</svg>
			</div>	
			<div v-show="currentUser.permissions.host">
				<div class="flex justify-center gap-8">
					<button @click="socketRevote()" class="p-2 text-blue-800 dark:text-orange-500 text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 hover:text-white dark:hover:text-white hover:bg-blue-800 dark:hover:bg-orange-500">Revote</button>
					<button @click="showStoryPointsPrompt = true" class="p-2 text-white text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 dark:bg-orange-500 bg-blue-800 hover:text-blue-800 dark:hover:text-orange-500 hover:bg-white dark:hover:bg-white">New Story</button>
					<ModalPopup @close="showStoryPointsPrompt = false" v-if="showStoryPointsPrompt">
						<SetStoryPointsPromt :default="getWinningVote(currentRoom)" @close="showStoryPointsPrompt = false" @set-story-points="(points) => socketNewTopic(points)"></SetStoryPointsPromt>
					</ModalPopup>
				</div>
			</div>
			<div class="flex justify-center gap-4">
				<button @click="selectedChart = 'pie'; nextTick(updateColors)" class="p-2 text-blue-800 dark:text-orange-500 text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 hover:text-white dark:hover:text-white hover:bg-blue-800 dark:hover:bg-orange-500">Pie Chart</button>
				<button @click="selectedChart = 'donut'; nextTick(updateColors)" class="p-2 text-blue-800 dark:text-orange-500 text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 hover:text-white dark:hover:text-white hover:bg-blue-800 dark:hover:bg-orange-500">Donut Chart</button>
				<button @click="selectedChart = 'bar'; nextTick(updateColors)" class="p-2 text-blue-800 dark:text-orange-500 text-base font-small rounded-md pr-4 pl-4 shadow border border-blue-800 dark:border-orange-500 hover:text-white dark:hover:text-white hover:bg-blue-800 dark:hover:bg-orange-500">Bar Chart</button>
			</div>
			<div class="flex justify-center">
				<div v-if="selectedChart == 'pie'" class="flex justify-center w-[300px] sm:w-[400px]">
					<Pie ref="pie" :data="pieData" :options="chartOptions"/>
				</div>
				<div v-if="selectedChart == 'donut'" class="flex justify-center">
					<Doughnut ref="doughnut" v-if="selectedChart == 'donut'" :data="pieData" :options="chartOptions" />
				</div>
				<div v-if="selectedChart == 'bar'" class="flex justify-center">
					<Bar ref="bar" :data="pieData" :options="chartOptions" />
				</div>
			</div>
		</div>
		<div class="flex flex-col gap-5 xl:w-1/2">
			<div>
				<div class="bg-gray-300 dark:bg-gray-700 rounded-2xl">
					<div class="flex justify-between pt-5 pl-16 pr-16">
						<p class="font-bold text-black dark:text-gray-300">Name</p>
						<p class="font-bold text-black dark:text-gray-300">Status</p>
					</div>
					<div class="border-slate-400 border-t-2 mt-5 pt-6 pb-6 flex flex-col gap-2">
						<roomMemberDisplayItem v-for="member in currentRoomMembers" :user-id=userId :member=member :room-status=currentRoom.status :lowest-vote="lowestVote" :highest-vote="highestVote"></roomMemberDisplayItem>
					</div>
				</div>
			</div>
			<div v-if="currentUser.permissions.host" class="flex items-center gap-5">
				<input v-if="currentRoom.urlName == ''" v-model="roomUrlName" placeholder="Enter Story URL" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4">
				<a v-else @click="confirmHyperlink(currentRoom.urlName)" target="_blank" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4 underline cursor-pointer truncate">
					{{ currentRoom.urlName }}
				</a>
				<svg v-if="currentRoom.urlName != roomUrlName" @click="socketSetUrl()" mlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-floppy-fill cursor-pointer" viewBox="0 0 16 16">
					<path d="M0 1.5A1.5 1.5 0 0 1 1.5 0H3v5.5A1.5 1.5 0 0 0 4.5 7h7A1.5 1.5 0 0 0 13 5.5V0h.086a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5H14v-5.5A1.5 1.5 0 0 0 12.5 9h-9A1.5 1.5 0 0 0 2 10.5V16h-.5A1.5 1.5 0 0 1 0 14.5z"/>
					<path d="M3 16h10v-5.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5zm9-16H4v5.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5zM9 1h2v4H9z"/>
				</svg>
				<button v-else-if="currentRoom.urlName != ''" @click="roomUrlName = ''; socketSetUrl()" class="text-black dark:text-white text-xl">✕</button>
			</div>
			<div v-else class="flex">
				<input v-if="currentRoom.urlName == ''" disabled v-model="roomUrlName" placeholder="URL" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4">
				<a v-else @click="confirmHyperlink(currentRoom.urlName)" target="_blank" class="w-full bg-gray-300 dark:bg-gray-700 rounded-2xl p-4 underline cursor-pointer truncate">
					{{ currentRoom.urlName }}
				</a>
			</div>
			<div class="bg-gray-300 dark:bg-gray-700 rounded-2xl flex p-4 w-full justify-between">
				<p class="">{{roomLink}}</p>
				<div v-if="!copied">
					<svg @click="copy()" class="cursor-pointer" v-if="colormode.preference == 'dark'" width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M18 6.96558C17.9896 6.87448 17.9695 6.78473 17.94 6.69784V6.60859C17.8919 6.50662 17.8278 6.4129 17.75 6.33092L11.75 0.380993C11.6673 0.303858 11.5728 0.240258 11.47 0.192578C11.4402 0.188374 11.4099 0.188374 11.38 0.192578C11.2784 0.134806 11.1662 0.0977206 11.05 0.0834961H7C6.20435 0.0834961 5.44129 0.396929 4.87868 0.954843C4.31607 1.51276 4 2.26945 4 3.05846V4.05012H3C2.20435 4.05012 1.44129 4.36355 0.87868 4.92146C0.316071 5.47938 0 6.23607 0 7.02508V16.9416C0 17.7306 0.316071 18.4873 0.87868 19.0452C1.44129 19.6032 2.20435 19.9166 3 19.9166H11C11.7956 19.9166 12.5587 19.6032 13.1213 19.0452C13.6839 18.4873 14 17.7306 14 16.9416V15.95H15C15.7956 15.95 16.5587 15.6365 17.1213 15.0786C17.6839 14.5207 18 13.764 18 12.975V7.02508C18 7.02508 18 7.02508 18 6.96558ZM12 3.46504L14.59 6.03343H13C12.7348 6.03343 12.4804 5.92895 12.2929 5.74298C12.1054 5.55701 12 5.30477 12 5.04177V3.46504ZM12 16.9416C12 17.2046 11.8946 17.4569 11.7071 17.6428C11.5196 17.8288 11.2652 17.9333 11 17.9333H3C2.73478 17.9333 2.48043 17.8288 2.29289 17.6428C2.10536 17.4569 2 17.2046 2 16.9416V7.02508C2 6.76208 2.10536 6.50985 2.29289 6.32388C2.48043 6.1379 2.73478 6.03343 3 6.03343H4V12.975C4 13.764 4.31607 14.5207 4.87868 15.0786C5.44129 15.6365 6.20435 15.95 7 15.95H12V16.9416ZM16 12.975C16 13.238 15.8946 13.4902 15.7071 13.6762C15.5196 13.8622 15.2652 13.9667 15 13.9667H7C6.73478 13.9667 6.48043 13.8622 6.29289 13.6762C6.10536 13.4902 6 13.238 6 12.975V3.05846C6 2.79546 6.10536 2.54323 6.29289 2.35726C6.48043 2.17128 6.73478 2.06681 7 2.06681H10V5.04177C10 5.83078 10.3161 6.58748 10.8787 7.14539C11.4413 7.7033 12.2044 8.01674 13 8.01674H16V12.975Z" fill="white"/>
					</svg>
					<svg @click="copy()" class="cursor-pointer" v-else-if="colormode.preference == 'dark'" width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M18 6.96558C17.9896 6.87448 17.9695 6.78473 17.94 6.69784V6.60859C17.8919 6.50662 17.8278 6.4129 17.75 6.33092L11.75 0.380993C11.6673 0.303858 11.5728 0.240258 11.47 0.192578C11.4402 0.188374 11.4099 0.188374 11.38 0.192578C11.2784 0.134806 11.1662 0.0977206 11.05 0.0834961H7C6.20435 0.0834961 5.44129 0.396929 4.87868 0.954843C4.31607 1.51276 4 2.26945 4 3.05846V4.05012H3C2.20435 4.05012 1.44129 4.36355 0.87868 4.92146C0.316071 5.47938 0 6.23607 0 7.02508V16.9416C0 17.7306 0.316071 18.4873 0.87868 19.0452C1.44129 19.6032 2.20435 19.9166 3 19.9166H11C11.7956 19.9166 12.5587 19.6032 13.1213 19.0452C13.6839 18.4873 14 17.7306 14 16.9416V15.95H15C15.7956 15.95 16.5587 15.6365 17.1213 15.0786C17.6839 14.5207 18 13.764 18 12.975V7.02508C18 7.02508 18 7.02508 18 6.96558ZM12 3.46504L14.59 6.03343H13C12.7348 6.03343 12.4804 5.92895 12.2929 5.74298C12.1054 5.55701 12 5.30477 12 5.04177V3.46504ZM12 16.9416C12 17.2046 11.8946 17.4569 11.7071 17.6428C11.5196 17.8288 11.2652 17.9333 11 17.9333H3C2.73478 17.9333 2.48043 17.8288 2.29289 17.6428C2.10536 17.4569 2 17.2046 2 16.9416V7.02508C2 6.76208 2.10536 6.50985 2.29289 6.32388C2.48043 6.1379 2.73478 6.03343 3 6.03343H4V12.975C4 13.764 4.31607 14.5207 4.87868 15.0786C5.44129 15.6365 6.20435 15.95 7 15.95H12V16.9416ZM16 12.975C16 13.238 15.8946 13.4902 15.7071 13.6762C15.5196 13.8622 15.2652 13.9667 15 13.9667H7C6.73478 13.9667 6.48043 13.8622 6.29289 13.6762C6.10536 13.4902 6 13.238 6 12.975V3.05846C6 2.79546 6.10536 2.54323 6.29289 2.35726C6.48043 2.17128 6.73478 2.06681 7 2.06681H10V5.04177C10 5.83078 10.3161 6.58748 10.8787 7.14539C11.4413 7.7033 12.2044 8.01674 13 8.01674H16V12.975Z" fill="black"/>
					</svg>
				</div>
				<div v-else class="cursor-pointer">
					<p>✅</p>
				</div>
			</div>
		</div>
	</div>

	<div v-if="currentRoom.status == HCRoomStatus.coffeebreak" class="flex items-center flex-col w-full h-full mt-7">
		<div v-if="!currentUser.permissions.host" class="flex items-center flex-col">
			<h1 class="w-96 text-center text-black dark:text-gray-50 text-5xl font-bold">Coffee Break!</h1>
			<p class="w-96 text-center text-black dark:text-gray-50 text-xl font-medium leading-loose">Wait Here Till The Host Ends The Break...</p>
			<svg class="w-full" viewBox="0 0 358 358" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path v-if="colormode.preference == 'dark'" d="M134.25 253.583H193.917C213.698 253.583 232.668 245.725 246.655 231.738C260.642 217.751 268.5 198.781 268.5 179V164.083H283.417C295.285 164.083 306.668 159.369 315.06 150.976C323.452 142.584 328.167 131.202 328.167 119.333C328.167 107.465 323.452 96.0826 315.06 87.6903C306.668 79.2981 295.285 74.5833 283.417 74.5833H268.5V59.6667C268.5 55.7105 266.929 51.9164 264.131 49.119C261.334 46.3216 257.54 44.75 253.583 44.75H74.5835C70.6273 44.75 66.8332 46.3216 64.0358 49.119C61.2384 51.9164 59.6668 55.7105 59.6668 59.6667V179C59.6668 198.781 67.5247 217.751 81.5118 231.738C95.4989 245.725 114.469 253.583 134.25 253.583ZM268.5 104.417H283.417C287.373 104.417 291.167 105.988 293.965 108.786C296.762 111.583 298.333 115.377 298.333 119.333C298.333 123.289 296.762 127.084 293.965 129.881C291.167 132.678 287.373 134.25 283.417 134.25H268.5V104.417ZM89.5002 74.5833H238.667V179C238.667 190.868 233.952 202.251 225.56 210.643C217.168 219.035 205.785 223.75 193.917 223.75H134.25C122.382 223.75 110.999 219.035 102.607 210.643C94.2149 202.251 89.5002 190.868 89.5002 179V74.5833ZM313.25 283.417H44.7502C40.794 283.417 36.9999 284.988 34.2025 287.786C31.4051 290.583 29.8335 294.377 29.8335 298.333C29.8335 302.289 31.4051 306.084 34.2025 308.881C36.9999 311.678 40.794 313.25 44.7502 313.25H313.25C317.206 313.25 321 311.678 323.798 308.881C326.595 306.084 328.167 302.289 328.167 298.333C328.167 294.377 326.595 290.583 323.798 287.786C321 284.988 317.206 283.417 313.25 283.417Z" fill="#F7F8F9"/>
				<path v-if="colormode.preference == 'light'" d="M134.25 253.583H193.917C213.698 253.583 232.668 245.725 246.655 231.738C260.642 217.751 268.5 198.781 268.5 179V164.083H283.417C295.285 164.083 306.668 159.369 315.06 150.976C323.452 142.584 328.167 131.202 328.167 119.333C328.167 107.465 323.452 96.0826 315.06 87.6903C306.668 79.2981 295.285 74.5833 283.417 74.5833H268.5V59.6667C268.5 55.7105 266.929 51.9164 264.131 49.119C261.334 46.3216 257.54 44.75 253.583 44.75H74.5835C70.6273 44.75 66.8332 46.3216 64.0358 49.119C61.2384 51.9164 59.6668 55.7105 59.6668 59.6667V179C59.6668 198.781 67.5247 217.751 81.5118 231.738C95.4989 245.725 114.469 253.583 134.25 253.583ZM268.5 104.417H283.417C287.373 104.417 291.167 105.988 293.965 108.786C296.762 111.583 298.333 115.377 298.333 119.333C298.333 123.289 296.762 127.084 293.965 129.881C291.167 132.678 287.373 134.25 283.417 134.25H268.5V104.417ZM89.5002 74.5833H238.667V179C238.667 190.868 233.952 202.251 225.56 210.643C217.168 219.035 205.785 223.75 193.917 223.75H134.25C122.382 223.75 110.999 219.035 102.607 210.643C94.2149 202.251 89.5002 190.868 89.5002 179V74.5833ZM313.25 283.417H44.7502C40.794 283.417 36.9999 284.988 34.2025 287.786C31.4051 290.583 29.8335 294.377 29.8335 298.333C29.8335 302.289 31.4051 306.084 34.2025 308.881C36.9999 311.678 40.794 313.25 44.7502 313.25H313.25C317.206 313.25 321 311.678 323.798 308.881C326.595 306.084 328.167 302.289 328.167 298.333C328.167 294.377 326.595 290.583 323.798 287.786C321 284.988 317.206 283.417 313.25 283.417Z" fill="#000000"/>
			</svg>
		</div>
		<div v-else class="flex items-center flex-col">
			<h1 class="w-96 text-center text-black dark:text-gray-50 text-5xl font-bold">Coffee Break!</h1>
			<p class="w-96 text-center text-black dark:text-gray-50 text-xl font-medium leading-loose">Click The Button To Start Again...</p>
			<svg class="w-full" viewBox="0 0 358 358" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path v-if="colormode.preference == 'dark'" d="M134.25 253.583H193.917C213.698 253.583 232.668 245.725 246.655 231.738C260.642 217.751 268.5 198.781 268.5 179V164.083H283.417C295.285 164.083 306.668 159.369 315.06 150.976C323.452 142.584 328.167 131.202 328.167 119.333C328.167 107.465 323.452 96.0826 315.06 87.6903C306.668 79.2981 295.285 74.5833 283.417 74.5833H268.5V59.6667C268.5 55.7105 266.929 51.9164 264.131 49.119C261.334 46.3216 257.54 44.75 253.583 44.75H74.5835C70.6273 44.75 66.8332 46.3216 64.0358 49.119C61.2384 51.9164 59.6668 55.7105 59.6668 59.6667V179C59.6668 198.781 67.5247 217.751 81.5118 231.738C95.4989 245.725 114.469 253.583 134.25 253.583ZM268.5 104.417H283.417C287.373 104.417 291.167 105.988 293.965 108.786C296.762 111.583 298.333 115.377 298.333 119.333C298.333 123.289 296.762 127.084 293.965 129.881C291.167 132.678 287.373 134.25 283.417 134.25H268.5V104.417ZM89.5002 74.5833H238.667V179C238.667 190.868 233.952 202.251 225.56 210.643C217.168 219.035 205.785 223.75 193.917 223.75H134.25C122.382 223.75 110.999 219.035 102.607 210.643C94.2149 202.251 89.5002 190.868 89.5002 179V74.5833ZM313.25 283.417H44.7502C40.794 283.417 36.9999 284.988 34.2025 287.786C31.4051 290.583 29.8335 294.377 29.8335 298.333C29.8335 302.289 31.4051 306.084 34.2025 308.881C36.9999 311.678 40.794 313.25 44.7502 313.25H313.25C317.206 313.25 321 311.678 323.798 308.881C326.595 306.084 328.167 302.289 328.167 298.333C328.167 294.377 326.595 290.583 323.798 287.786C321 284.988 317.206 283.417 313.25 283.417Z" fill="#F7F8F9"/>
				<path v-if="colormode.preference == 'light'" d="M134.25 253.583H193.917C213.698 253.583 232.668 245.725 246.655 231.738C260.642 217.751 268.5 198.781 268.5 179V164.083H283.417C295.285 164.083 306.668 159.369 315.06 150.976C323.452 142.584 328.167 131.202 328.167 119.333C328.167 107.465 323.452 96.0826 315.06 87.6903C306.668 79.2981 295.285 74.5833 283.417 74.5833H268.5V59.6667C268.5 55.7105 266.929 51.9164 264.131 49.119C261.334 46.3216 257.54 44.75 253.583 44.75H74.5835C70.6273 44.75 66.8332 46.3216 64.0358 49.119C61.2384 51.9164 59.6668 55.7105 59.6668 59.6667V179C59.6668 198.781 67.5247 217.751 81.5118 231.738C95.4989 245.725 114.469 253.583 134.25 253.583ZM268.5 104.417H283.417C287.373 104.417 291.167 105.988 293.965 108.786C296.762 111.583 298.333 115.377 298.333 119.333C298.333 123.289 296.762 127.084 293.965 129.881C291.167 132.678 287.373 134.25 283.417 134.25H268.5V104.417ZM89.5002 74.5833H238.667V179C238.667 190.868 233.952 202.251 225.56 210.643C217.168 219.035 205.785 223.75 193.917 223.75H134.25C122.382 223.75 110.999 219.035 102.607 210.643C94.2149 202.251 89.5002 190.868 89.5002 179V74.5833ZM313.25 283.417H44.7502C40.794 283.417 36.9999 284.988 34.2025 287.786C31.4051 290.583 29.8335 294.377 29.8335 298.333C29.8335 302.289 31.4051 306.084 34.2025 308.881C36.9999 311.678 40.794 313.25 44.7502 313.25H313.25C317.206 313.25 321 311.678 323.798 308.881C326.595 306.084 328.167 302.289 328.167 298.333C328.167 294.377 326.595 290.583 323.798 287.786C321 284.988 317.206 283.417 313.25 283.417Z" fill="#000000"/>
			</svg>
			<button @click="socketSetCoffeeBreak(false)" class="p-3 text-white dark:text-white text-base font-small rounded-md pr-8 pl-8 shadow bg-blue-800 dark:bg-orange-500 border border-transparent">End Coffee Break</button>
		</div>
	</div>
</template>
