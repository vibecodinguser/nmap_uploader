import { HttpResponse, http } from 'msw'
import {
  DISK_API,
  DISK_APPLICATIONS_PATH,
  getRequestSearchParam,
  getTokenFromAuth,
  isExpiredToken,
  LOGIN_INFO,
} from './yandex_mock_state'

function handleDiskRootGet({ request }: { request: Request }) {
  let response: Response
  const token = getTokenFromAuth(request)

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 })
  } else {
    const fields = getRequestSearchParam(request, 'fields')
    if (fields?.includes('system_folders')) {
      response = HttpResponse.json({
        system_folders: { applications: DISK_APPLICATIONS_PATH },
      })
    } else {
      response = HttpResponse.json({ total_space: 10_000_000_000 })
    }
  }

  return response
}

function handleLoginInfoGet({ request }: { request: Request }) {
  let response: Response
  const token = getTokenFromAuth(request)

  if (isExpiredToken(token)) {
    response = new HttpResponse(null, { status: 401 })
  } else {
    response = HttpResponse.json({
      id: '123',
      login: 'testuser',
      display_name: 'Test User',
      default_avatar_id: '131652443',
    })
  }

  return response
}

export const yandexAuthHandlers = [
  http.get(`${DISK_API}/`, handleDiskRootGet),
  http.get(LOGIN_INFO, handleLoginInfoGet),
]
