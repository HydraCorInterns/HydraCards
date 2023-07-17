require("dotenv").config();

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	runtimeConfig: {
		// Will be available in both server and client
		public: {
			socketUrl: '',
			baseUrl: process.env.BASE_URL,
			serverUrl: process.env.SERVER_URL
		},
	},
	devServer: {
		port: parseInt(process.env.FRONTEND_PORT || "3001"),
	},
	devtools: { enabled: true },
	modules: [
		'@nuxtjs/tailwindcss'
	],
	router: {
		//@ts-ignore
		middleware: ['nullroomredirect'],
	},
	ssr: true
})
