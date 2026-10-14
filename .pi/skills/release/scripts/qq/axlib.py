import time
from ApplicationServices import *
from ApplicationServices import AXValueGetValue, kAXValueCGPointType, kAXValueCGSizeType
from CoreFoundation import kCFBooleanTrue

def get(el, name):
    err, val = AXUIElementCopyAttributeValue(el, name, None)
    return val if err == 0 else None

def setv(el, name, val):
    err = AXUIElementSetAttributeValue(el, name, val)
    return err

def point(el):
    v = get(el, kAXPositionAttribute)
    if v is None: return None
    ok, p = AXValueGetValue(v, kAXValueCGPointType, None)
    return (round(p.x), round(p.y)) if ok else None

def size(el):
    v = get(el, kAXSizeAttribute)
    if v is None: return None
    ok, s = AXValueGetValue(v, kAXValueCGSizeType, None)
    return (round(s.width), round(s.height)) if ok else None

def children(el):
    return list(get(el, kAXChildrenAttribute) or [])

def app_for(pid):
    return AXUIElementCreateApplication(pid)

def enable_ax(app, wait=0.6):
    r1 = setv(app, "AXEnhancedUserInterface", kCFBooleanTrue)
    r2 = setv(app, "AXManualAccessibility", kCFBooleanTrue)
    time.sleep(wait)
    return r1, r2

def walk(root, maxdepth=30, budget=20000):
    """Yield (element, depth)."""
    stack=[(root,0)]
    n=0
    while stack:
        el,d = stack.pop()
        n+=1
        if n>budget: return
        yield el,d
        if d>=maxdepth: continue
        for k in children(el):
            stack.append((k,d+1))

def find(root, pred, maxdepth=30, budget=20000):
    res=[]
    for el,d in walk(root,maxdepth,budget):
        try:
            if pred(el,d): res.append((el,d))
        except Exception: pass
    return res

def describe(el, d=0):
    role=get(el,kAXRoleAttribute); sub=get(el,kAXSubroleAttribute)
    title=get(el,kAXTitleAttribute); val=get(el,kAXValueAttribute); desc=get(el,kAXDescriptionAttribute)
    if isinstance(val,str) and len(val)>100: val=val[:100]+'…'
    if isinstance(title,str) and len(title)>100: title=title[:100]+'…'
    return f"{'  '*d}{role}{'/'+str(sub) if sub else ''} t={title!r} d={desc!r} v={val!r} p={point(el)} s={size(el)}"

def click(el):
    err = AXUIElementPerformAction(el, kAXPressAction)
    if err != 0:
        err = AXUIElementPerformAction(el, "AXOpen")
    return err

def set_value(el, text):
    return AXUIElementSetAttributeValue(el, kAXValueAttribute, text)

def focused_el(app):
    return get(app, kAXFocusedUIElementAttribute)
