export default defineNuxtRouteMiddleware(async (to, from) => {
	const id = useCookie("_id")
	const config = useRuntimeConfig()
	
	if (id != undefined){
		try{
		const { data: userobj } = await useFetch(`api/user/getUserById?id=` + id.value, { baseURL: config.public.baseUrl })
		//const response = await fetch(config.public.baseUrl + `/api/user/getUserById?id=` + id.value)
		//const user = await response.json()

		const user = userobj.value
		if (user != undefined){
			//@ts-ignore
			if (user.currentRoom != Number.parseInt(to.query.id as string)){
				return navigateTo("/join?id="+to.query.id)
			}
		} else {
			return navigateTo("/join?id="+to.query.id)
		}
	} catch {
		return navigateTo("/join?id="+to.query.id)
	}
	} else {
		return navigateTo("/join?id="+to.query.id)
	}

	if (to.query.id != undefined) {
		const config = useRuntimeConfig()

		const { data: room } = await useFetch("api/room/getRoomById?id=" + to.query.id, {baseURL: config.public.baseUrl})
		if (typeof room.value != typeof "")
		{
			return;
		}
	}
	return navigateTo("/error?errormsg=Sorry, that room does not exist.")
})