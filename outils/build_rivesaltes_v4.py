#!/usr/bin/env python3
"""Build a source-led, human-scale reconstruction of Îlot F at Rivesaltes.

Footprints are traced from the Mémorial's published 1939 plan image. The building
skins are an interpretive reconstruction from the user's photographs and the
Ministry of Culture's description. The single furnished cutaway is explicitly
an educational evocation, not a documented room layout.
"""
from __future__ import annotations

import io
import json
import math
import random
import struct
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

OUT = Path(__file__).parent
SCALE = 0.42  # m per source-plan pixel; building size is kept indicative.
MAP_CENTRE = (579.0, 276.0)

# Bounding boxes of the ~60 long, narrow building footprints digitized from the
# Mémorial's archival plan of Îlot F (1939). The scan itself is linked in-app.
PLAN_BOXES = [
    (128,1,9,60),(226,1,80,22),(451,1,80,17),(965,1,75,16),
    (433,23,102,21),(749,26,59,16),(850,27,73,17),(336,29,65,17),
    (849,55,74,17),(451,57,77,17),(745,57,69,15),(743,82,71,22),
    (967,84,73,17),(225,86,86,18),(1053,92,38,78),(180,98,31,73),
    (856,110,21,44),(391,113,12,45),(968,160,73,19),(225,164,77,17),
    (453,165,77,17),(849,192,76,16),(337,193,89,23),(453,195,78,27),
    (731,217,79,34),(850,220,75,16),(459,223,76,23),(330,224,90,17),
    (969,244,95,29),(1143,247,12,57),(224,252,75,17),(722,252,96,23),
    (444,253,92,24),(784,273,38,7),(392,280,13,45),(26,295,31,8),
    (419,318,15,33),(30,329,58,14),(769,332,48,15),(217,333,82,19),
    (456,334,75,15),(503,348,94,12),(852,360,74,19),(731,361,80,23),
    (339,362,76,16),(454,363,76,17),(121,380,24,58),(852,389,75,19),
    (714,390,117,21),(450,392,84,16),(330,397,73,10),(967,408,78,31),
    (222,418,98,22),(853,418,74,21),(321,420,93,19),(731,420,101,16),
    (450,422,88,20),(390,448,11,43),(976,495,70,20),(336,497,49,19),
    (892,498,36,17),(223,499,77,16),(991,524,60,23),(336,527,42,19),
    (223,531,77,18),(783,529,32,13),
]

def keep_footprint(b):
    _, _, w, h = b
    return max(w, h) >= 40 and min(w, h) >= 10

BUILDINGS = [b for b in PLAN_BOXES if keep_footprint(b)]
assert len(BUILDINGS) == 60, len(BUILDINGS)

# GLB materials; vertex colors carry the hand-built material/weathering variation.
MATS = [
    "terrain", "compact-earth", "brick-a", "brick-b", "brick-c", "mortar",
    "roof-light", "roof-dark", "roof-rib", "timber", "opening", "plinth",
    "fence", "footpath", "dry-plant", "stone", "distant-hill",
    "coastal-sand", "lagoon-water", "mediterranean-water", "corbiere-rock",
    "corbiere-shadow", "visitor-skin", "visitor-jacket", "visitor-trouser",
    "visitor-shoe", "visitor-hair", "visitor-pack", "visitor-map", "visitor-detail",
]
MAT_INDEX = {n:i for i,n in enumerate(MATS)}
FACES: dict[str,list] = {n:[] for n in MATS}
MAT_TEXTURE = {
    "terrain":"earth-photo", "compact-earth":"earth", "footpath":"earth-photo", "brick-a":"brick-photo", "brick-b":"brick-photo",
    "plinth":"stone", "roof-light":"roof-photo", "roof-dark":"roof-photo",
    "timber":"wood", "stone":"stone", "coastal-sand":"sand",
    "lagoon-water":"water", "mediterranean-water":"water", "corbiere-rock":"stone",
    "corbiere-shadow":"stone",
}
TEXTURE_UV = {
    # The earth tile is quieter and finer-grained than the former orange gravel.
    "terrain":(1/18,1/18), "compact-earth":(1/12,1/12), "footpath":(1/5,1/5),
    "brick-a":(1/1.25,1/.89), "brick-b":(1/1.25,1/.89), "brick-c":(1/1.25,1/.89),
    "mortar":(1/3.4,1/3.0), "plinth":(1/4,1/4), "stone":(1/6,1/6),
    "roof-light":(1/12,1/1.76), "roof-dark":(1/12,1/1.76), "timber":(1/3,1/1.5),
    "coastal-sand":(1/22,1/22), "lagoon-water":(1/90,1/90),
    "mediterranean-water":(1/90,1/90), "corbiere-rock":(1/16,1/16),
    "corbiere-shadow":(1/16,1/16),
}
FULL_ALBEDO_MATS={"terrain","brick-a","brick-b","roof-light","roof-dark"}
GENERATED_TEXTURES={
    "brick-photo":"barrack_brick_albedo.png",
    "roof-photo":"roof_albedo_source.png",
    "earth-photo":"site_earth_albedo.png",
}
FOOTPATHS=[]

def hexrgb(s):
    s=s.lstrip("#")
    def linear(v):
        c=int(v,16)/255
        return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
    return tuple(linear(s[i:i+2]) for i in (0,2,4))

def face(mat, pts, color):
    FACES[mat].append((pts, hexrgb(color) if isinstance(color,str) else color))

def quad(mat, a,b,c,d,color):
    face(mat,(a,b,c,d),color)

def box(mat,x0,x1,y0,y1,z0,z1,color):
    quad(mat,(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1),color)
    quad(mat,(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0),color)
    quad(mat,(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1),color)
    quad(mat,(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0),color)
    quad(mat,(x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0),color)
    quad(mat,(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1),color)

def surface(mat, pts, color):
    face(mat,pts,color)

def terrain_y(x,z):
    return .54 + .14*math.sin(x*.009)*math.cos(z*.011) + .055*math.sin((x+z)*.027)

def build_barrack_mesh(variant):
    # Local axes: long direction X, roof ridge Y, width Z; dimensions about 30 x 6 m.
    L,W,EAVE,RIDGE = 30.0,6.0,3.05,4.55
    halfL,halfW=L/2,W/2
    wall_colors=[("#b87855","#c58a68","#b97956"),
                 ("#b88768","#c59a79","#a96e51"),
                 ("#ae7257","#c09272","#bd8061")]
    main=wall_colors[variant]
    # A low, slightly battered stone/plinth base.
    box("plinth",-halfL-.2,halfL+.2,0.0,.38,-halfW-.18,halfW+.18,
        ("#807668","#968a76","#746b60")[variant])
    # Brick walls, four sides and two gables.
    box("brick-a",-halfL,halfL,.38,EAVE,-halfW,halfW,main[0])
    # A high-resolution albedo map supplies the small brick courses and mortar.
    for side in (-1,1):
        z=side*(halfW+.012)
        # A handful of old limewash/repair patches lend surface age without fake graffiti.
        patches=[(-10.4,.52,2.8,.56),(-2.2,1.74,1.9,.44),(7.5,.92,2.1,.72),(12.0,2.12,1.5,.4)]
        patch_color=("#d2b397","#d8c1a5","#c8a38a")[variant]
        for x,y,w,h in patches:
            surface("brick-c",[(x,y,z*1.002),(x+w,y,z*1.002),(x+w,y+h,z*1.002),(x,y+h,z*1.002)],patch_color)
    # Gable-end wall triangles.
    for x,sign in [(-halfL-.012,-1),(halfL+.012,1)]:
        pts=[(x,.38,-halfW),(x,.38,halfW),(x,EAVE,halfW),(x,RIDGE,0),(x,EAVE,-halfW)]
        for i in range(1,len(pts)-1): face("brick-b",(pts[0],pts[i],pts[i+1]),main[1])
        # End doors: dark recessed panels, timber outer frame, plank joints.
        door_w,door_h=1.35,2.18
        for side in (-1,1):
            xx=x+sign*.025
            quad("opening",(xx,.42,-door_w/2),(xx,.42,door_w/2),(xx,door_h,door_w/2),(xx,door_h,-door_w/2),"#352e28")
            for zedge in (-door_w/2-.12,door_w/2+.12):
                box("timber",xx-.06,xx+.06,.4,door_h+.1,zedge-.1,zedge+.1,"#73513d")
            for y in [.72,1.02,1.32,1.62,1.92]:
                quad("timber",(xx+sign*.008,y,-door_w/2+.08),(xx+sign*.008,y+.025,door_w/2-.08),
                     (xx+sign*.008,y+.025,door_w/2-.08),(xx+sign*.008,y,-door_w/2+.08),"#896347")
    # Long-side apertures with deep shadow, pale lintels and timber shutters.
    for side in (-1,1):
        z=side*(halfW+.04)
        for wx in [-11.0,-5.0,1.0,7.0,12.0]:
            w,h=1.05,.78; y=1.68
            quad("opening",(wx-w/2,y,z),(wx+w/2,y,z),(wx+w/2,y+h,z),(wx-w/2,y+h,z),"#292e2d")
            # weathered timber shutter halves
            for dx in [-.44,.44]:
                quad("timber",(wx+dx-.2,y+.02,z+side*.018),(wx+dx+.2,y+.02,z+side*.018),
                     (wx+dx+.2,y+h-.02,z+side*.018),(wx+dx-.2,y+h-.02,z+side*.018),"#8a6a50")
            # sill and lintel
            z0,z1=sorted((side*(halfW+.07),side*(halfW+.22)))
            box("plinth",wx-w/2-.12,wx+w/2+.12,y-.12,y-.04,z0,z1,"#d0b79a")
            box("plinth",wx-w/2-.12,wx+w/2+.12,y+h+.02,y+h+.11,z0,z1,"#d0b79a")
    # Lightweight, patinated sheet-metal gable roof with visible standing ribs.
    roof_col=("#777b78","#8b8b82","#676f70")[variant]
    for side in (-1,1):
        z0=side*.02; z1=side*(halfW+.38)
        y0=RIDGE+.08; y1=EAVE-.02
        quad("roof-light",(-halfL-.42,y0,z0),(halfL+.42,y0,z0),(halfL+.42,y1,z1),(-halfL-.42,y1,z1),roof_col)
        for i in range(1,18):
            z=side*(i*W/36)
            y=RIDGE+.08-(RIDGE-EAVE)*(abs(z)/halfW)
            dz=side*.035
            y2=RIDGE+.08-(RIDGE-EAVE)*(abs(z+dz)/halfW)
            quad("roof-rib",(-halfL-.43,y+.018,z),(halfL+.43,y+.018,z),(halfL+.43,y2+.018,z+dz),(-halfL-.43,y2+.018,z+dz),"#aa9d86")
        # Occasional oxidized/worn patches on the roof plane.
        for x,zcenter,width in [(-7.5,side*1.25,1.5),(4.5,side*2.0,1.0)]:
            def ry(zz): return RIDGE+.08-(RIDGE-EAVE)*(abs(zz)/halfW)+.03
            zlo,zhi=zcenter-width/2,zcenter+width/2
            quad("roof-dark",(x,ry(zlo),zlo),(x+2.0,ry(zlo),zlo),(x+2.0,ry(zhi),zhi),(x,ry(zhi),zhi),"#6c6256")
    # Ridge cap and timber fascia.
    box("roof-dark",-halfL-.45,halfL+.45,RIDGE+.06,RIDGE+.16,-.12,.12,"#77766e")
    for side in (-1,1):
        z0,z1=sorted((side*(halfW+.35),side*(halfW+.44)))
        box("timber",-halfL-.45,halfL+.45,EAVE-.12,EAVE+.01,z0,z1,"#695844")
    return

def add_roof_variant_colors():
    pass

def build_ground_and_site():
    rng=random.Random(1941)
    # Island F ground is a broad dry plain, with very gentle undulation.
    xmin,xmax,zmin,zmax=-570,570,-380,380
    nx,nz=74,50
    for iz in range(nz):
        z0=zmin+(zmax-zmin)*iz/nz; z1=zmin+(zmax-zmin)*(iz+1)/nz
        for ix in range(nx):
            x0=xmin+(xmax-xmin)*ix/nx; x1=xmin+(xmax-xmin)*(ix+1)/nx
            cx=(x0+x1)/2; cz=(z0+z1)/2
            tone=(math.sin(cx*.014+math.sin(cz*.008)*1.2)*3.2+
                  math.cos(cz*.017-cx*.007)*2.0)
            # Compact earth is blended into the ground albedo instead of laid
            # over it as large, flat quads. Those old overlays crossed the
            # undulating terrain and created the broad triangular z-fighting
            # artifact visible from the camp entrance.
            compacted=((-505<=cx<=-65 and -9<=cz<=9) or
                       (-63<=cx<=58 and -38<=cz<=38) or
                       (60<=cx<=280 and -7<=cz<=7) or
                       (-180<=cx<=180 and 105<=cz<=111))
            if compacted: tone-=6
            delta=round(tone)
            col=f"#{169+delta:02x}{157+delta:02x}{130+delta:02x}"
            quad("terrain",(x0,terrain_y(x0,z0),z0),(x1,terrain_y(x1,z0),z0),(x1,terrain_y(x1,z1),z1),(x0,terrain_y(x0,z1),z1),col)
    # Sparse low garrigue: tiny clustered leaves, mostly outside the lived-in rows.
    for _ in range(480):
        x=rng.uniform(xmin,xmax); z=rng.uniform(zmin,zmax)
        if abs(x)<300 and abs(z)<155 and rng.random()<.92: continue
        if -440<x<440 and -230<z<230 and rng.random()<.86: continue
        ground=terrain_y(x,z)
        height=rng.uniform(.35,1.1); width=rng.uniform(.25,.9)
        color=rng.choice(["#777458","#8b855f","#91865d","#6f7153"])
        for angle in [0,math.pi/3,2*math.pi/3]:
            dx=math.cos(angle)*width; dz=math.sin(angle)*width
            quad("dry-plant",(x-dx,ground,z-dz),(x,ground+height,z),(x+dx,ground,z+dz),(x,ground+height,z),color)
    # Gravel chips scattered on the hard ground; subdued and low to preserve the floor.
    for _ in range(900):
        x=rng.uniform(-540,540); z=rng.uniform(-355,355)
        y=terrain_y(x,z)+.03
        r=rng.uniform(.08,.42); c=rng.choice(["#766d5b","#938774","#a99d87","#6b665c"])
        # flattened irregular triangular stones
        points=[]
        for j in range(5):
            a=j*2*math.pi/5+rng.uniform(-.12,.12); rr=r*rng.uniform(.65,1.25)
            points.append((x+math.cos(a)*rr,y+.02,z+math.sin(a)*rr))
        for j in range(1,4): face("stone",((x,y+.035,z),points[j],points[j+1]),c)

def build_fence_and_paths():
    # Îlot boundary: roughly 42 ha; wire enclosure separated from the buildings.
    rng=random.Random(27)
    xmin,xmax,zmin,zmax=-440,440,-228,228
    gate_x=xmin
    for z in range(-228,229,7):
        if abs(z)<6: continue
        for x in (xmin,xmax):
            y=terrain_y(x,z)+.04
            box("fence",x-.055,x+.055,y,y+1.62,z-.055,z+.055,"#625b50")
    for x in range(-440,441,7):
        for z in (zmin,zmax):
            y=terrain_y(x,z)+.04
            box("fence",x-.055,x+.055,y,y+1.62,z-.055,z+.055,"#625b50")
    # Parallel wire strands. The gap at the west is an interpretive access point.
    def strand(a,b,c,d,height):
        steps=max(1,int(math.dist((a,b),(c,d))/12))
        for i in range(steps):
            t0=i/steps;t1=(i+1)/steps
            x0=a+(c-a)*t0;z0=b+(d-b)*t0;x1=a+(c-a)*t1;z1=b+(d-b)*t1
            y0=terrain_y(x0,z0)+height;y1=terrain_y(x1,z1)+height
            dx=x1-x0; dz=z1-z0; length=math.hypot(dx,dz) or 1; offx=-dz/length*.022; offz=dx/length*.022
            quad("fence",(x0+offx,y0,z0+offz),(x1+offx,y1,z1+offz),(x1-offx,y1,z1-offz),(x0-offx,y0,z0-offz),"#514c45")
    for h in [.42,.84,1.26]:
        strand(xmin,-228,xmin,-7,h); strand(xmin,7,xmin,228,h)
        strand(xmax,-228,xmax,228,h); strand(-440,zmin,440,zmin,h); strand(-440,zmax,440,zmax,h)
    # An open, unlatched-looking gate frame marks the threshold; no guard post is invented.
    for z in [-5.4,5.4]:
        y=terrain_y(xmin,z)+.04
        box("fence",xmin-.18,xmin+.18,y,y+2.0,z-.13,z+.13,"#665847")
    gate_y=terrain_y(xmin,0)+2.0
    box("fence",xmin-.18,xmin+.18,gate_y,gate_y+.14,-5.4,5.4,"#665847")
    # Short, subtle footpaths occupy open gaps between adjacent barracks.
    # Their exact routes are interpretive; the archival plan records footprints,
    # not a measured pedestrian path network.
    rng=random.Random(4102)
    buildings=[]
    for i,(px,py,pw,ph) in enumerate(BUILDINGS,1):
        cx=(px+pw/2-MAP_CENTRE[0])*SCALE
        cz=(MAP_CENTRE[1]-(py+ph/2))*SCALE
        length=min(38,max(25,max(pw,ph)*SCALE))
        width=min(8,max(5,min(pw,ph)*SCALE))
        yaw=0 if pw>=ph else math.pi/2
        buildings.append((i,cx,cz,length,width,yaw))

    def local_to_world(b,lx,lz):
        _,cx,cz,_,_,yaw=b;c=math.cos(yaw);s=math.sin(yaw)
        return (cx+c*lx-s*lz,cz+s*lx+c*lz)

    paths=[]
    for ia,a in enumerate(buildings):
        for b in buildings[ia+1:]:
            if abs(a[5]-b[5])>.01: continue
            dx, dz=b[1]-a[1],b[2]-a[2]
            c,s=math.cos(a[5]),math.sin(a[5])
            along=c*dx-s*dz
            across=s*dx+c*dz
            overlap=min(a[3],b[3])*.5-abs(along)*.5
            gap=abs(across)-(a[4]+b[4])*.5
            if 1.6<=gap<=7.5 and overlap>=5 and math.hypot(dx,dz)<19:
                # Leave a little breathing room at each end; stagger the short
                # worn stretch so the paths do not form one artificial stripe.
                length=min(rng.uniform(5.0,9.0),overlap*1.35)
                centre_along=max(-overlap+length/2,min(overlap-length/2,rng.uniform(-overlap*.55,overlap*.55)))
                centre_across=(a[4]/2+gap/2) * (1 if across>0 else -1)
                wiggle=rng.uniform(-.28,.28)
                local=[(centre_along-length/2,centre_across-wiggle),
                       (centre_along,centre_across+wiggle),
                       (centre_along+length/2,centre_across-wiggle*.6)]
                pts=[local_to_world(a,x,z) for x,z in local]
                paths.append((pts,rng.uniform(.72,.96)))
            elif abs(across)<(a[4]+b[4])*.5-0.7 and 1.6<=abs(along)-(a[3]+b[3])*.5<=7.5:
                # A few short cross-links at aligned end doors.
                gapx=abs(along)-(a[3]+b[3])*.5
                length=min(rng.uniform(2.8,5.2),gapx+1.0)
                centre_along=(a[3]/2+gapx/2)*(1 if along>0 else -1)
                centre_across=rng.uniform(-min(a[4],b[4])*.25,min(a[4],b[4])*.25)
                local=[(centre_along-length/2,centre_across-.18),
                       (centre_along,centre_across+.18),
                       (centre_along+length/2,centre_across)]
                pts=[local_to_world(a,x,z) for x,z in local]
                paths.append((pts,rng.uniform(.72,.9)))

    # Prefer a sparse set of links, distributed across the settlement rows.
    paths=paths[::2]
    FOOTPATHS.clear()
    for pts,width in paths:
        FOOTPATHS.append([[round(x,2),round(z,2)] for x,z in pts])
        for p0,p1 in zip(pts,pts[1:]):
            dx, dz=p1[0]-p0[0],p1[1]-p0[1]
            le=math.hypot(dx,dz) or 1
            ox=-dz/le*width/2;oz=dx/le*width/2
            a=(p0[0]+ox,p0[1]+oz);b=(p1[0]+ox,p1[1]+oz)
            c=(p1[0]-ox,p1[1]-oz);d=(p0[0]-ox,p0[1]-oz)
            quad("footpath",(a[0],terrain_y(*a)+.045,a[1]),
                 (b[0],terrain_y(*b)+.045,b[1]),
                 (c[0],terrain_y(*c)+.045,c[1]),
                 (d[0],terrain_y(*d)+.045,d[1]),"#e8dcc7")

def ellipsoid(mat, center, radii, color, segments=12, rings=8):
    """Faceted, rounded form made from latitude/longitude rings."""
    cx,cy,cz=center; rx,ry,rz=radii
    grid=[]
    for ri in range(rings+1):
        phi=-math.pi/2+math.pi*ri/rings
        row=[]
        for si in range(segments):
            theta=2*math.pi*si/segments
            row.append((cx+rx*math.cos(phi)*math.cos(theta),
                        cy+ry*math.sin(phi),
                        cz+rz*math.cos(phi)*math.sin(theta)))
        grid.append(row)
    for r in range(rings):
        for s in range(segments):
            face(mat,(grid[r][s],grid[r][(s+1)%segments],
                      grid[r+1][(s+1)%segments],grid[r+1][s]),color)

def tapered_limb(mat, start, end, r0, r1, color, segments=10):
    """A softly tapered low-poly limb, built along an arbitrary axis."""
    a=tuple(start); b=tuple(end)
    axis=[b[i]-a[i] for i in range(3)]
    length=math.sqrt(sum(v*v for v in axis)) or 1
    axis=[v/length for v in axis]
    ref=[0,0,1] if abs(axis[2])<.85 else [1,0,0]
    u=[axis[1]*ref[2]-axis[2]*ref[1],axis[2]*ref[0]-axis[0]*ref[2],axis[0]*ref[1]-axis[1]*ref[0]]
    ul=math.sqrt(sum(v*v for v in u)) or 1;u=[v/ul for v in u]
    v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]]
    ring0=[];ring1=[]
    for i in range(segments):
        ang=2*math.pi*i/segments
        ring0.append(tuple(a[k]+r0*(math.cos(ang)*u[k]+math.sin(ang)*v[k]) for k in range(3)))
        ring1.append(tuple(b[k]+r1*(math.cos(ang)*u[k]+math.sin(ang)*v[k]) for k in range(3)))
    for i in range(segments):
        j=(i+1)%segments
        face(mat,(ring0[i],ring0[j],ring1[j],ring1[i]),color)
    face(mat,tuple(reversed(ring0)),color);face(mat,tuple(ring1),color)

def build_regional_landscape():
    """Regional context, deliberately schematic and spatially compressed."""
    # A subdued extension of the stony plain. It sits below the accurately
    # traced island ground so the close reconstruction remains legible.
    quad("terrain",(-2700,.22,-4300),(2700,.22,-4300),(2700,.22,4300),(-2700,.22,4300),"#a99d82")
    rng=random.Random(66)
    # Pale, dry patches and low scrub between camp and the lagoon.
    for _ in range(250):
        x=rng.uniform(-2100,1700);z=rng.uniform(-4100,4100)
        if -570<x<570 and -380<z<380: continue
        y=.245;r=rng.uniform(18,65)
        c=rng.choice(["#b4a789","#9f967d","#c0b293","#a69b80"])
        quad("terrain",(x-r,y,z-r*.62),(x+r,y,z-r*.45),(x+r*.7,y,z+r),(x-r*.8,y,z+r*.7),c)
    for _ in range(360):
        x=rng.uniform(-2200,1600);z=rng.uniform(-4000,4000)
        if -650<x<650 and -430<z<430: continue
        y=.27;height=rng.uniform(5,14);width=rng.uniform(3,10)
        c=rng.choice(["#77775b","#8a845f","#928662","#6d7154"])
        for angle in (0,math.pi/3,2*math.pi/3):
            dx=math.cos(angle)*width;dz=math.sin(angle)*width
            quad("dry-plant",(x-dx,y,z-dz),(x,y+height,z),(x+dx,y,z+dz),(x,y+height,z),c)

    # A coastal lagoon, pale sand barrier and the Mediterranean are shown as a
    # regional panorama. Their distance is intentionally not to scale.
    lagoon_edges=[(1780,-3900),(2180,-3650),(2110,-2100),(2250,-400),
                  (2180,1200),(2250,2950),(2110,3900),(1740,4100)]
    for i in range(len(lagoon_edges)-1):
        a=lagoon_edges[i];b=lagoon_edges[i+1]
        quad("lagoon-water",(a[0],.28,a[1]),(b[0],.28,b[1]),(b[0]+160,.28,b[1]),(a[0]+160,.28,a[1]),
             "#708f8c" if i%2 else "#789795")
    # Sand and low dune ridges sit between lagoon and open sea.
    quad("coastal-sand",(2260,.26,-4300),(2790,.26,-4300),(2790,.26,4300),(2260,.26,4300),"#d0bd91")
    for i in range(17):
        z=-4000+i*490
        y=.34+0.12*math.sin(i*.8)
        quad("coastal-sand",(2320,y,z),(2720,y+.12,z),(2720,y+.12,z+250),(2320,y,z+250),
             "#d8c79e" if i%2 else "#c7b48c")
    quad("mediterranean-water",(2790,.24,-4700),(8400,.24,-4700),(8400,.24,4700),(2790,.24,4700),"#527d83")
    for i in range(28):
        x=3000+i*185
        z=-4300+(i%4)*1350
        quad("mediterranean-water",(x,.255,z),(x+125,.255,z+420),(x+132,.255,z+435),(x+7,.255,z+15),
             "#72969a" if i%2 else "#648a8f")

    # Corbières skyline: several distant limestone ridges, not a wall beside the camp.
    profile=[(-3100,170),(-2680,230),(-2320,205),(-2010,335),(-1660,275),
             (-1290,465),(-930,310),(-560,560),(-180,395),(230,630),
             (610,410),(980,520),(1330,330),(1690,440),(2070,250),(2520,190)]
    z=-2450
    for i in range(len(profile)-1):
        (x0,h0),(x1,h1)=profile[i],profile[i+1]
        color="#8d897d" if i%3 else "#77786f"
        face("corbiere-rock",((x0,0,z),(x1,0,z),(x1,h1,z),(x0,h0,z)),color)
        # A pale fractured face breaks up the silhouette without invented buildings.
        peakx=(x0+x1)/2;peaky=(h0+h1)/2
        face("corbiere-shadow",((x0,0,z-.5),(peakx,peaky,z-.5),(x0,h0,z-.5)),"#a19a88")
    profile2=[(-3200,105),(-2700,155),(-2250,135),(-1800,220),(-1300,170),
              (-800,250),(-250,185),(300,290),(850,215),(1350,265),(1900,155),(2600,115)]
    z=-2820
    for i in range(len(profile2)-1):
        (x0,h0),(x1,h1)=profile2[i],profile2[i+1]
        face("corbiere-rock",((x0,0,z),(x1,0,z),(x1,h1,z),(x0,h0,z)),"#aaa28f")

def build_visitor_character():
    """A contemporary student visitor, a scale marker only (not an internee)."""
    skin="#b77f61"; jacket="#4f7775"; jacket_light="#73918a"
    trousers="#374148"; shoes="#d3c9b6"; hair="#302c29"
    # Shoes and lower legs; front of the figure is local +Z.
    ellipsoid("visitor-shoe",(-.105,.075,.075),(.105,.075,.19),shoes)
    ellipsoid("visitor-shoe",(.105,.075,.075),(.105,.075,.19),shoes)
    tapered_limb("visitor-trouser",(-.105,.16,0),(-.12,.79,0),.075,.115,trousers)
    tapered_limb("visitor-trouser",(.105,.16,0),(.12,.79,0),.075,.115,trousers)
    ellipsoid("visitor-jacket",(0,1.00,0),(.235,.305,.145),jacket,14,10)
    ellipsoid("visitor-jacket",(0,.765,0),(.205,.12,.135),jacket,14,8)
    # Relaxed arms and open hands; one hand holds a folded visit map.
    tapered_limb("visitor-jacket",(-.205,1.20,0),(-.30,.98,.045),.095,.072,jacket)
    tapered_limb("visitor-jacket",(-.30,.98,.045),(-.105,.79,.17),.072,.057,jacket_light)
    ellipsoid("visitor-skin",(-.09,.765,.18),(.055,.075,.06),skin)
    tapered_limb("visitor-jacket",(.205,1.20,0),(.32,.96,-.015),.095,.07,jacket)
    tapered_limb("visitor-jacket",(.32,.96,-.015),(.31,.73,.02),.07,.055,jacket_light)
    ellipsoid("visitor-skin",(.31,.695,.025),(.055,.075,.06),skin)
    # Neck and head, with ears, hairline, eyes and a restrained profile.
    ellipsoid("visitor-skin",(0,1.315,0),(.07,.09,.065),skin)
    ellipsoid("visitor-skin",(0,1.48,.012),(.142,.17,.125),skin,14,10)
    ellipsoid("visitor-hair",(0,1.598,-.015),(.145,.072,.128),hair,14,8)
    ellipsoid("visitor-hair",(-.095,1.52,-.01),(.052,.11,.12),hair,10,8)
    ellipsoid("visitor-hair",(.094,1.53,-.01),(.05,.09,.115),hair,10,8)
    # A soft fringe, ears and facial features face toward +Z.
    ellipsoid("visitor-hair",(0,1.574,.09),(.105,.045,.045),hair,12,6)
    ellipsoid("visitor-skin",(-.145,1.48,0),(.03,.05,.035),skin,10,8)
    ellipsoid("visitor-skin",(.145,1.48,0),(.03,.05,.035),skin,10,8)
    ellipsoid("visitor-detail",(-.052,1.49,.124),(.014,.018,.009),"#2a2927",8,6)
    ellipsoid("visitor-detail",(.052,1.49,.124),(.014,.018,.009),"#2a2927",8,6)
    ellipsoid("visitor-skin",(0,1.45,.139),(.018,.03,.025),skin,8,6)
    # Backpack with visible straps and a small folded field map.
    ellipsoid("visitor-pack",(0,1.06,-.175),(.17,.235,.09),"#8a7658",12,8)
    tapered_limb("visitor-pack",(-.17,1.29,.035),(-.14,.92,.09),.026,.026,"#b29b71",8)
    tapered_limb("visitor-pack",(.17,1.29,.035),(.14,.92,.09),.026,.026,"#b29b71",8)
    box("visitor-map",-.19,-.005,.67,.84,.19,.215,"#e5d6ae")
    quad("visitor-detail",(-.15,.73,.218),(-.045,.73,.218),(-.045,.75,.218),(-.15,.75,.218),"#8b4c36")

def periodic_noise(size, seed, bands=(1,2,4,8,16,32,64)):
    rng=np.random.default_rng(seed)
    axis=np.arange(size,dtype=np.float32)/size
    xx,yy=np.meshgrid(axis,axis)
    out=np.zeros((size,size),dtype=np.float32)
    weight=0.0
    for i,f in enumerate(bands):
        phase=rng.uniform(0,2*math.pi)
        amp=1/(1+0.38*i)
        out += amp*np.sin(2*math.pi*(f*xx+(f//2+1)*yy)+phase)
        out += amp*.55*np.cos(2*math.pi*((f//2+1)*xx-f*yy)-phase*.73)
        weight += 1.55*amp
    return out/weight

def make_texture_png(name, size=512):
    """Create seamless reflectance maps that preserve the modeled material colors."""
    if name in GENERATED_TEXTURES:
        source=Image.open(OUT/"textures"/GENERATED_TEXTURES[name]).convert("RGB")
        source=source.resize((512,512),Image.Resampling.LANCZOS)
        if name=="roof-photo": source=source.transpose(Image.Transpose.ROTATE_90)
        left=ImageOps.mirror(source); top=ImageOps.flip(source); opposite=ImageOps.flip(left)
        tile=Image.new("RGB",(1024,1024))
        tile.paste(source,(0,0));tile.paste(left,(512,0));tile.paste(top,(0,512));tile.paste(opposite,(512,512))
        buf=io.BytesIO();tile.save(buf,format="PNG",optimize=True)
        return buf.getvalue()
    seed=41+sum(ord(c) for c in name)
    noise=periodic_noise(size,seed)
    fine=periodic_noise(size,seed+91,bands=(3,7,15,31,63))
    axis=np.arange(size,dtype=np.float32)/size
    xx,yy=np.meshgrid(axis,axis)
    if name=="brick":
        # Fine clay variation only; the actual small brick courses are geometry.
        value=244+noise*4+fine*2
        warm=np.stack((value+2,value,value-3),axis=-1)
    elif name=="roof":
        corrugation=np.cos(2*math.pi*yy*18.0)
        stain=np.sin(2*math.pi*(yy*2.2+np.sin(2*math.pi*xx*3.0)*.05))
        value=241+noise*5+fine*2+corrugation*2+stain*2
        warm=np.stack((value,value-1,value-3),axis=-1)
    else:
        strength={"earth":7,"sand":5,"water":3,"stone":8,"wood":6}[name]
        variation=noise*strength+fine*2
        if name=="water":
            variation += np.cos(2*math.pi*(yy*13+np.sin(2*math.pi*yy*3)*.035))*2
        if name=="wood":
            variation += np.cos(2*math.pi*yy*26)*2
        tint={"earth":(1,0,-4),"sand":(2,0,-7),"water":(-3,0,2),
              "stone":(0,-1,-5),"wood":(2,0,-5)}[name]
        value=242+variation
        warm=np.stack((value+tint[0],value+tint[1],value+tint[2]),axis=-1)
    img=Image.fromarray(np.uint8(np.clip(warm,222,255)),"RGB")
    buf=io.BytesIO();img.save(buf,format="PNG",optimize=True)
    return buf.getvalue()

def make_normal_png(name):
    """Derive a tileable tangent-space normal map from each generated surface."""
    source=Image.open(OUT/"textures"/GENERATED_TEXTURES[name]).convert("RGB")
    source=source.resize((512,512),Image.Resampling.LANCZOS)
    if name=="roof-photo": source=source.transpose(Image.Transpose.ROTATE_90)
    gray=np.asarray(source.convert("L"),dtype=np.float32)/255.0
    left=np.fliplr(gray);top=np.flipud(gray);opposite=np.flipud(left)
    height=np.block([[gray,left],[top,opposite]])
    dx=np.gradient(height,axis=1);dy=np.gradient(height,axis=0)
    strength={"brick-photo":5.5,"roof-photo":8.0,"earth-photo":4.0}[name]
    nx=-dx*strength;ny=-dy*strength;nz=np.ones_like(height)
    length=np.sqrt(nx*nx+ny*ny+nz*nz)
    rgb=np.stack((nx/length,ny/length,nz/length),axis=-1)*.5+.5
    image=Image.fromarray(np.uint8(np.clip(rgb*255,0,255)),"RGB").resize((512,512),Image.Resampling.LANCZOS)
    buf=io.BytesIO();image.save(buf,format="PNG",optimize=True)
    return buf.getvalue()

def make_skybox_png():
    """A soft, warm, hazy sky for the exhibit view; the land remains modeled."""
    w,h=1536,768
    anchors=[(0.0,(109,135,154)),(.34,(155,177,187)),(.56,(211,208,194)),(.68,(226,211,185)),(1.0,(183,177,160))]
    y=np.linspace(0,1,h,dtype=np.float32)
    stops=np.asarray([a[0] for a in anchors],dtype=np.float32)
    cols=np.asarray([a[1] for a in anchors],dtype=np.float32)
    rows=np.stack([np.interp(y,stops,cols[:,c]) for c in range(3)],axis=-1)
    sky=np.repeat(rows[:,None,:],w,axis=1)
    axis=np.arange(w,dtype=np.float32)/w
    xx,yy=np.meshgrid(axis,y)
    clouds=(np.sin(2*math.pi*(xx*2.2+np.sin(2*math.pi*yy*1.8)*.07))+
            .56*np.sin(2*math.pi*(xx*4.1-yy*1.7))+.22*np.cos(2*math.pi*(xx*7+yy*3)))
    cloud_alpha=np.clip((clouds-.34)*.13,0,.09)*(1-np.clip((yy-.5)*4,0,1))
    cloud_color=np.zeros_like(sky);cloud_color[:]=[246,242,231]
    sky=sky*(1-cloud_alpha[:,:,None])+cloud_color*cloud_alpha[:,:,None]
    # Soft haze just above the modeled horizon.
    haze=np.exp(-((yy-.59)/.055)**2)*.18
    haze_color=np.zeros_like(sky);haze_color[:]=[236,220,191]
    sky=sky*(1-haze[:,:,None])+haze_color*haze[:,:,None]
    # A broad, diffused afternoon glow gives the ridge and plain a shared light.
    glow=np.exp(-(((xx-.72)/.18)**2+((yy-.57)/.105)**2))*0.17
    glow_color=np.zeros_like(sky);glow_color[:]=[255,226,184]
    sky=sky*(1-glow[:,:,None])+glow_color*glow[:,:,None]
    img=Image.fromarray(np.uint8(np.clip(sky,0,255)),"RGB")
    buf=io.BytesIO();img.save(buf,format="PNG",optimize=True)
    return buf.getvalue()

def as_mesh_data(faces, mat):
    pos=[];norm=[];colors=[];uvs=[];idx=[]
    su,sv=TEXTURE_UV.get(mat,(1.0,1.0))
    for points,color in faces:
        rgb=color
        for tri in [(points[0],points[i],points[i+1]) for i in range(1,len(points)-1)]:
            a,b,c=tri
            u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
            n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            l=math.sqrt(sum(x*x for x in n)) or 1;n=[x/l for x in n]
            start=len(pos)//3
            for p in tri:
                pos.extend(p)
                norm.extend(n)
                colors.extend((1.0,1.0,1.0,1.0) if mat in FULL_ALBEDO_MATS else (*rgb,1.0))
                if mat.startswith("roof-"): uvs.extend((p[0]*su,p[2]*sv))
                elif abs(n[1])>=abs(n[2]) and abs(n[1])>=abs(n[0]): uvs.extend((p[0]*su,p[2]*sv))
                elif abs(n[2])>=abs(n[0]): uvs.extend((p[0]*su,p[1]*sv))
                else: uvs.extend((p[2]*su,p[1]*sv))
            idx.extend((start,start+1,start+2))
    return pos,norm,colors,uvs,idx

BIN=bytearray(); VIEWS=[]; ACCESSORS=[]; MESHES=[]; NODES=[]
def accessor(vals,ctype,atype,target=None,bounds=False):
    while len(BIN)%4: BIN.append(0)
    offset=len(BIN)
    fmt={5126:"f",5123:"H",5125:"I"}[ctype]
    BIN.extend(struct.pack("<"+fmt*len(vals),*vals))
    v={"buffer":0,"byteOffset":offset,"byteLength":len(BIN)-offset}
    if target:v["target"]=target
    VIEWS.append(v)
    n={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}[atype]
    a={"bufferView":len(VIEWS)-1,"componentType":ctype,"count":len(vals)//n,"type":atype}
    if bounds and atype=="VEC3":
        xyz=[vals[i:i+3] for i in range(0,len(vals),3)]
        a["min"]=[min(p[j] for p in xyz) for j in range(3)]
        a["max"]=[max(p[j] for p in xyz) for j in range(3)]
    ACCESSORS.append(a);return len(ACCESSORS)-1

def add_mesh(name,mat_faces):
    prim=[]
    for mat,faces in mat_faces.items():
        if not faces: continue
        p,n,c,uv,ix=as_mesh_data(faces,mat)
        pa=accessor(p,5126,"VEC3",34962,True);na=accessor(n,5126,"VEC3",34962)
        ca=accessor(c,5126,"VEC4",34962);ua=accessor(uv,5126,"VEC2",34962);ia=accessor(ix,5123,"SCALAR",34963)
        prim.append({"attributes":{"POSITION":pa,"NORMAL":na,"COLOR_0":ca,"TEXCOORD_0":ua},"indices":ia,
                     "material":MAT_INDEX[mat],"mode":4})
    MESHES.append({"name":name,"primitives":prim});return len(MESHES)-1

def node(name,mesh=None,translation=None,rotation=None,scale=None,children=None,extras=None):
    d={"name":name}
    if mesh is not None:d["mesh"]=mesh
    if translation is not None:d["translation"]=list(translation)
    if rotation is not None:d["rotation"]=list(rotation)
    if scale is not None:d["scale"]=list(scale)
    if children:d["children"]=children
    if extras:d["extras"]=extras
    NODES.append(d);return len(NODES)-1

def pack_glb(scene_name,roots):
    texture_sources={};normal_sources={};images=[];textures=[]
    for name in sorted(set(MAT_TEXTURE.values())):
        png=make_texture_png(name)
        while len(BIN)%4:BIN.append(0)
        offset=len(BIN);BIN.extend(png)
        VIEWS.append({"buffer":0,"byteOffset":offset,"byteLength":len(png)})
        image_index=len(images)
        images.append({"name":f"Texture {name}","bufferView":len(VIEWS)-1,"mimeType":"image/png"})
        texture_sources[name]=len(textures)
        textures.append({"sampler":0,"source":image_index})
        if name in GENERATED_TEXTURES:
            normal=make_normal_png(name)
            while len(BIN)%4:BIN.append(0)
            offset=len(BIN);BIN.extend(normal)
            VIEWS.append({"buffer":0,"byteOffset":offset,"byteLength":len(normal)})
            image_index=len(images)
            images.append({"name":f"Normal {name}","bufferView":len(VIEWS)-1,"mimeType":"image/png"})
            normal_sources[name]=len(textures)
            textures.append({"sampler":0,"source":image_index})
    while len(BIN)%4:BIN.append(0)
    mats=[]
    for name in MATS:
        pbr={"baseColorFactor":[1,1,1,1],"metallicFactor":0.0,"roughnessFactor":0.88}
        if name=="brick-b":pbr["baseColorFactor"]=[.94,.94,.92,1]
        if name=="roof-dark":pbr["baseColorFactor"]=[.62,.64,.65,1]
        material={"name":name,"pbrMetallicRoughness":pbr,"doubleSided":True}
        if name in MAT_TEXTURE:
            texture_name=MAT_TEXTURE[name]
            pbr["baseColorTexture"]={"index":texture_sources[texture_name],"texCoord":0}
            if texture_name in normal_sources:
                material["normalTexture"]={"index":normal_sources[texture_name],"texCoord":0,"scale":0.72}
        if name.startswith("roof"):
            pbr["metallicFactor"]=.16;pbr["roughnessFactor"]=.66
        elif name.endswith("water"):
            pbr["metallicFactor"]=.04;pbr["roughnessFactor"]=.34
        elif name in ("visitor-shoe","visitor-detail"):
            pbr["roughnessFactor"]=.78
        mats.append(material)
    doc={"asset":{"version":"2.0","generator":"Rivesaltes educational reconstruction v6"},
         "scene":0,"scenes":[{"name":scene_name,"nodes":roots,
            "extras":{"sourcePlan":"Mémorial du camp de Rivesaltes, plan de l'îlot F, 1939",
                      "accuracy":"Footprints traced from plan; dimensions and façade details interpretive."}}],
         "nodes":NODES,"meshes":MESHES,"materials":mats,"textures":textures,
         "images":images,"samplers":[{"magFilter":9729,"minFilter":9987,"wrapS":10497,"wrapT":10497}],
         "buffers":[{"byteLength":len(BIN)}],"bufferViews":VIEWS,"accessors":ACCESSORS}
    payload=json.dumps(doc,ensure_ascii=False,separators=(",",":")).encode()
    while len(payload)%4:payload+=b" "
    total=12+8+len(payload)+8+len(BIN)
    out=bytearray(struct.pack("<III",0x46546C67,2,total))
    out.extend(struct.pack("<II",len(payload),0x4E4F534A));out.extend(payload)
    out.extend(struct.pack("<II",len(BIN),0x004E4942));out.extend(BIN)
    return bytes(out)

def main():
    build_ground_and_site();build_fence_and_paths();build_regional_landscape()
    terrain=add_mesh("Plaine sèche et horizon",{m:FACES[m] for m in ["terrain","compact-earth","distant-hill"]})
    plants=add_mesh("Garrigue clairsemée et cailloutis",{m:FACES[m] for m in ["dry-plant","stone"]})
    fence=add_mesh("Clôture et petits sentiers d’évocation",{m:FACES[m] for m in ["fence","footpath"]})
    geo=add_mesh("Contexte régional schématique — Corbières, lagune et Méditerranée",
                 {m:FACES[m] for m in ["coastal-sand","lagoon-water","mediterranean-water","corbiere-rock","corbiere-shadow"]})
    roots=[node("Sol et horizon",terrain),node("Végétation basse et sol pierreux",plants),
           node("Limite et sentiers indicatifs",fence,extras={"accuracy":"Sentiers courts d'évocation pédagogique, non tracés d'après un plan historique."}),node("Paysage régional — distances hors échelle",geo,
           extras={"description":"Mise en contexte schématique : plaine sèche, Corbières, lagune, cordon sableux et Méditerranée. Distances non représentées à l'échelle."})]
    building_meshes=[]
    for v in range(3):
        for m in MATS: FACES[m]=[]
        build_barrack_mesh(v)
        keep=["plinth","brick-a","brick-b","brick-c","mortar","roof-light","roof-dark","roof-rib","timber","opening"]
        building_meshes.append(add_mesh(f"Baraque en brique, variante {v+1}",{m:FACES[m] for m in keep}))
    rng=random.Random(1942)
    for i,(x,y,w,h) in enumerate(BUILDINGS,1):
        cx=(x+w/2-MAP_CENTRE[0])*SCALE
        cz=(MAP_CENTRE[1]-(y+h/2))*SCALE
        long=max(w,h)*SCALE
        short=min(w,h)*SCALE
        length=max(25,min(38,long));width=max(5,min(8,short))
        rot=0 if w>=h else math.pi/2
        q=(0,math.sin(rot/2),0,math.cos(rot/2)) if rot else (0,0,0,1)
        variant=(i*7+int(cx*2)+int(cz))%3
        roots.append(node(f"Baraque {i:02d}",building_meshes[variant],(cx,terrain_y(cx,cz)+.06,cz),q,(length/30,1,width/6),
            extras={"source_bbox_px":[x,y,w,h],"implantation":"tracée du plan 1939 de l'îlot F","dimensions":"indicatives"}))
    # Archive annotations and one representative site marker.
    roots.append(node("Repère de la cour centrale",None,(0,0,0),extras={"description":"La place et ses abords sont à confronter au parcours actuel du Mémorial."}))
    glb=pack_glb("Rivesaltes — îlot F · parcours 1939–1942 et paysage régional",roots)
    glb_path=OUT/"rivesaltes_ilot_f.glb";glb_path.write_bytes(glb)
    create_html(glb,glb_path)
    write_pwa_assets()
    make_zip(glb_path)
    print(json.dumps({"buildings":len(BUILDINGS),"glb_bytes":len(glb),"html_bytes":(OUT/"index.html").stat().st_size,
                      "zip":str(OUT/"Rivesaltes_ilot_F_3D_guide.zip")},ensure_ascii=False))

def create_html(glb,glb_path):
    template=(OUT/"viewer_template.html").read_text(encoding="utf-8")
    html=template.replace("__FOOTPATHS__",json.dumps(FOOTPATHS,separators=(",",":")))
    if "__FOOTPATHS__" in html: raise RuntimeError("The footpath map data was not embedded.")
    (OUT/"index.html").write_text(html,encoding="utf-8")

def write_pwa_assets():
    manifest={
        "name":"Rivesaltes — parcours de mémoire",
        "short_name":"Rivesaltes",
        "description":"Visite 3D pédagogique et documentée du camp de Rivesaltes, préparée pour un usage hors ligne.",
        "lang":"fr-FR","start_url":"./index.html","scope":"./","display":"standalone",
        "orientation":"any","background_color":"#171a18","theme_color":"#171a18",
        "icons":[
            {"src":"./icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any maskable"},
            {"src":"./icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}
        ]
    }
    (OUT/"manifest.webmanifest").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    worker=r'''const CACHE_NAME="rivesaltes-memoire-offline-v5";
const SHELL=["./","./index.html","./rivesaltes_ilot_f.glb","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
const RUNTIME=[
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/objects/Sky.js",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js"
];
async function announce(type,extra={}){const clients=await self.clients.matchAll({includeUncontrolled:true,type:"window"});for(const c of clients)c.postMessage({type,...extra});}
let cacheJob=null;
async function fillCache(){if(cacheJob)return cacheJob;cacheJob=(async()=>{const cache=await caches.open(CACHE_NAME);let done=0,failed=0;const urls=[...SHELL,...RUNTIME];for(const url of urls){try{if(!await cache.match(url)){const response=await fetch(url,{mode:"cors",cache:"reload"});if(!response.ok)throw new Error(String(response.status));await cache.put(url,response.clone());}}catch(err){failed++;}finally{done++;await announce("offline-progress",{done,total:urls.length});}}await announce(failed?"offline-error":"offline-ready",{done,total:urls.length});return failed;})();try{return await cacheJob;}finally{cacheJob=null;}}
self.addEventListener("install",event=>event.waitUntil((async()=>{await fillCache();await self.skipWaiting();})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE_NAME)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener("message",event=>{if(event.data?.type==="offline-precache")event.waitUntil(fillCache());if(event.data?.type==="offline-status")event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);const checks=await Promise.all([...SHELL,...RUNTIME].map(url=>cache.match(url)));const ready=checks.every(Boolean);await announce(ready?"offline-ready":"offline-error",{done:checks.filter(Boolean).length,total:checks.length});})());});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);const isRuntime=url.hostname==="cdn.jsdelivr.net"&&url.pathname.includes("/three@0.170.0/");if(url.origin!==self.location.origin&&!isRuntime)return;event.respondWith((async()=>{let cache;try{cache=await caches.open(CACHE_NAME);const cached=await cache.match(event.request,{ignoreSearch:false});if(cached)return cached;}catch(cacheReadError){console.warn("Lecture du cache indisponible",cacheReadError);}try{const response=await fetch(event.request);if(response.ok&&(url.origin===self.location.origin||isRuntime)){try{cache=cache||await caches.open(CACHE_NAME);await cache.put(event.request,response.clone());}catch(cacheWriteError){console.warn("Ressource chargée en ligne, mais non mise en cache",cacheWriteError);}}return response;}catch(fetchError){if(event.request.mode==="navigate"){try{const fallback=cache&&await cache.match("./index.html");if(fallback)return fallback;}catch(cacheFallbackError){console.warn("Page hors ligne indisponible",cacheFallbackError);}}throw fetchError;}})());});
'''
    (OUT/"sw.js").write_text(worker,encoding="utf-8")
    icons=OUT/"icons";icons.mkdir(exist_ok=True)
    for size in (192,512):
        im=Image.new("RGB",(size,size),(24,28,27));from PIL import ImageDraw
        d=ImageDraw.Draw(im)
        # Warm horizon, mineral plain, Corbières line and the outline of a barrack.
        d.ellipse((size*.64,size*.12,size*.84,size*.32),fill=(216,177,126))
        d.polygon([(0,size*.56),(size*.16,size*.48),(size*.28,size*.53),(size*.41,size*.43),(size*.55,size*.52),(size*.67,size*.47),(size,size*.55),(size,size),(0,size)],fill=(109,111,91))
        d.rectangle((0,size*.66,size,size),fill=(96,84,69))
        x0,y0,x1,y1=size*.19,size*.48,size*.81,size*.76
        d.rectangle((x0,y0+size*.09,x1,y1),fill=(157,91,65))
        d.polygon([(x0-size*.025,y0+size*.09),((x0+x1)/2,y0-size*.07),(x1+size*.025,y0+size*.09)],fill=(67,72,68))
        for n in range(1,5):
            y=y0+size*(.14+n*.10);d.line((x0,y,x1,y),fill=(191,126,89),width=max(1,size//220))
        d.rectangle((size*.45,size*.62,size*.55,size*.76),fill=(45,44,40))
        im.save(icons/f"icon-{size}.png",optimize=True)

def make_zip(glb_path):
    zpath=OUT/"Rivesaltes_ilot_F_3D_guide.zip"
    readme='''# Rivesaltes — parcours de mémoire, version mobile hors ligne

## Trois espaces

- `Explorer le camp` : promenade 3D, commande tactile, visiteur fictif optionnel, plan mis à jour selon la période, courts sentiers indicatifs et vue du paysage. Les façades bloquent le passage; un bouton ouvre une baraque témoin en coupe.
- `Repères historiques` : chronologie de 1939 à aujourd’hui; chaque date peut être ouverte dans la maquette.
- `Mon expérience` : choix de thèmes et carnet avant, pendant et après la visite. Les notes sont conservées sur l’appareil et peuvent être téléchargées en texte.

L’archive contient aussi le modèle glTF 2.0 (`rivesaltes_ilot_f.glb`), son gabarit (`viewer_template.html`), le générateur (`build_rivesaltes_v4.py`), le manifeste d’installation, le service worker et les icônes.

## Périmètre historique et géographique

Les empreintes des quelque soixante baraques de l’îlot F sont tracées à partir du plan historique de 1939 publié par le Mémorial du camp de Rivesaltes. Les périodes présentées sont 1939, 1941, 1942, 1945–1948, 1962–1964 et aujourd’hui. Le plan de 1939 reste la base visuelle lorsque l’implantation d’une période n’est pas documentée dans cette maquette. Les petits sentiers et l’intérieur meublé sont des évocations pédagogiques, pas des tracés ou un agencement attestés pour une baraque précise. Les lits superposés, couvertures et valises sont montrés sans personne représentée. Les tentes de 1962 et le Mémorial actuel sont également signalés comme schématiques. Les textures sont des matériaux créés pour la maquette, pas des photographies d’archives.

Le visiteur contemporain est fictif, caché au démarrage et affichable comme repère d’échelle; il ne représente pas une personne internée. Le modèle montre l’îlot F, pas les autres îlots. La vue régionale situe la plaine sèche, les Corbières, une lagune, un cordon sableux et la Méditerranée. Les distances du panorama sont comprimées.

Le carnet est enregistré dans le stockage local du navigateur. Aucune note n’est transmise. Il est conseillé aux élèves de ne pas y inscrire leur nom ni d’information personnelle.

## Aperçu local sur ordinateur

Décompresser l’archive, ouvrir un terminal dans le dossier puis lancer :

```bash
python3 -m http.server 8001
```

Ouvrir ensuite `http://localhost:8001` dans un navigateur. Laisser le terminal ouvert pendant la visite.

## Préparer un téléphone pour une visite sans réseau

1. Déployer le contenu de l’archive sur un site HTTPS.
2. Ouvrir la page une première fois avec le Wi-Fi et attendre que l’indicateur affiche « Prêt hors ligne ».
3. Installer la page depuis le navigateur. Sur iPhone : Safari → Partager → Sur l’écran d’accueil. Sur Android : « Installer l’application » dans le menu du navigateur.
4. Ouvrir l’application une fois, puis couper les données et vérifier le lancement hors ligne avant le départ.

Le premier chargement met en cache le modèle 3D (environ 12 Mo) et les modules Three.js. Une première ouverture en ligne est nécessaire pour remplir le cache. Les navigateurs peuvent effacer les données de sites lors d’un nettoyage du stockage.

Les sources et les limites de la restitution sont également rappelées dans l’application.
'''

    (OUT/"README_v4.md").write_text(readme,encoding="utf-8")
    with zipfile.ZipFile(zpath,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for name in ["index.html","README_v4.md",glb_path.name,"build_rivesaltes_v4.py","viewer_template.html","manifest.webmanifest","sw.js",
                     "icons/icon-192.png","icons/icon-512.png","textures/barrack_brick_albedo.png","textures/roof_albedo_source.png","textures/site_earth_albedo.png"]:
            z.write(OUT/name,name)

if __name__=="__main__": main()
