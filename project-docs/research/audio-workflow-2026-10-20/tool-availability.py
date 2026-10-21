"""Read-only host inventory; no synthesis, encoding, installation or playback."""
import ctypes
import json
import platform
import shutil

lib = ctypes.CDLL('/System/Library/Frameworks/AudioToolbox.framework/AudioToolbox')
u32 = ctypes.c_uint32


def fourcc(value):
    return int.from_bytes(value.encode('ascii'), 'big')


def query(info_name, get_name, property_id):
    size = u32()
    status = getattr(lib, info_name)(fourcc(property_id), 0, None, ctypes.byref(size))
    if status:
        return {'status': status}
    data = (u32 * (size.value // 4))()
    status = getattr(lib, get_name)(fourcc(property_id), 0, None, ctypes.byref(size), data)
    return {'status': status, 'ids': [v.to_bytes(4, 'big').decode('ascii') for v in data]}


print(json.dumps({
    'checked_date': '2026-10-20',
    'platform': platform.mac_ver()[0],
    'tools': {tool: shutil.which(tool) for tool in
              ['bun', 'ffmpeg', 'ffprobe', 'oggenc', 'opusenc', 'sox', 'afconvert']},
    'writable_containers': query('AudioFileGetGlobalInfoSize', 'AudioFileGetGlobalInfo', 'afwf'),
    'encodable_formats': query('AudioFormatGetPropertyInfo', 'AudioFormatGetProperty', 'acof'),
}, indent=2))
