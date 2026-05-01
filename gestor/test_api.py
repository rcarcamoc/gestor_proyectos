import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        res = await client.get('http://localhost:8000/telegram/get-tasks?chat_id=108605510')
        print('Tasks Status:', res.status_code)
        print('Tasks Response:', res.text)
        
        res = await client.get('http://localhost:8000/telegram/get-projects?chat_id=108605510')
        print('Projects Status:', res.status_code)
        print('Projects Response:', res.text)

asyncio.run(main())
