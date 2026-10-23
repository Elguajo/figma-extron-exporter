import io, struct, sys, zipfile

# extract <src.gdl> <out.ProjectGCP>        -> writes the ProjectGCP payload
# repack  <src.gdl> <new.ProjectGCP> <dst>  -> same container, ProjectGCP replaced, no .tgz4 (needs a fresh Build)


def swap(b, frm, to):
    b = bytearray(b)
    eocd = b.rfind(frm + b'\x05\x06')
    cd_size, cd_off = struct.unpack('<II', b[eocd + 12:eocd + 20])
    pos = cd_off
    while pos < cd_off + cd_size:
        assert b[pos:pos + 4] == frm + b'\x01\x02'
        nl, el, cl = struct.unpack('<HHH', b[pos + 28:pos + 34])
        lh = struct.unpack('<I', b[pos + 42:pos + 46])[0]
        assert b[lh:lh + 4] == frm + b'\x03\x04'
        b[lh:lh + 2] = to
        b[pos:pos + 2] = to
        pos += 46 + nl + el + cl
    b[eocd:eocd + 2] = to
    return bytes(b)


op = sys.argv[1]
outer = zipfile.ZipFile(io.BytesIO(swap(open(sys.argv[2], 'rb').read(), b'KP', b'PK')))
print('entries', outer.namelist())
if op == 'extract':
    open(sys.argv[3], 'wb').write(outer.read('ProjectGCP'))
elif op == 'repack':
    payload = open(sys.argv[3], 'rb').read()
    ob = io.BytesIO()
    with zipfile.ZipFile(ob, 'w', zipfile.ZIP_DEFLATED) as z:
        i = outer.getinfo('ProjectGCP')
        i.external_attr = 0
        z.writestr(i, payload)
    dst = sys.argv[4]
    with open(dst, 'xb') as f:
        f.write(swap(ob.getvalue(), b'PK', b'KP'))
    check = zipfile.ZipFile(io.BytesIO(swap(open(dst, 'rb').read(), b'KP', b'PK')))
    assert check.read('ProjectGCP') == payload and check.testzip() is None
    print('written', dst)
