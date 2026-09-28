"""Рендер камер сцены: python3 render_views.py scene.blend outdir pct samples CAM_01 CAM_02 ..."""
import bpy, sys, math, time, os
from mathutils import Vector
blend, outdir, pct, samples = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
cams = sys.argv[5:]
RES = {"CAM_01_Main": (1200, 1500), "CAM_02_High": (1320, 1200), "CAM_03_Window": (1500, 1200),
       "CAM_04_Reverse": (1500, 1000), "CAM_05_Plan": (1400, 1400)}
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
sc.cycles.samples = samples
sc.render.resolution_percentage = pct
sc.render.image_settings.file_format = 'PNG'
os.makedirs(outdir, exist_ok=True)
for cam in cams or RES.keys():
    sc.camera = bpy.data.objects[cam]
    sc.render.resolution_x, sc.render.resolution_y = RES[cam]
    plan = cam == "CAM_05_Plan"
    bpy.data.collections["Ceiling"].hide_render = plan
    sc.view_settings.exposure = 0.15 if plan else 1.1
    sun = bpy.data.objects["Sun"]
    d = Vector((-0.3, -0.5, -1.2)).normalized() if plan else Vector((-0.42, -1.0, -0.42)).normalized()
    sun.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(outdir, cam + ".png")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {cam} {time.time()-t:.1f}s", flush=True)
