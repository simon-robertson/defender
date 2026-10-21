// Fill the title viewport with landscape, including wide and portrait windows.
// The orthographic corner rays intersect a flat rectangle at path height.
export function frameTitle(camera){
 camera.frame();
 const aspect=camera.canvas.clientWidth/Math.max(1,camera.canvas.clientHeight),c=Math.abs(Math.cos(camera.yaw)),s=Math.abs(Math.sin(camera.yaw)),p=Math.sin(camera.pitch);
 camera.target.set([camera.width/2,camera.level?.pathHeight??24,camera.length/2]);
 camera.radius=.96*Math.min(camera.width/2/(aspect*c+s/p),camera.length/2/(aspect*s+c/p));
 camera.invalidate();
}
