/**
 * Villa Pérez · Hot-air balloon 3D for Mapbox GL JS Standard Satellite.
 * Procedural geometry, no third-party GLTF, no redesign of the official mouse.
 * Official ../perez.png is used as a flat, unmodified image in the basket.
 * Uses Mapbox's shared WebGL context (custom renderingMode: 3d).
 */
export function balloonFlightPose({coordinates,bearing=0,altitude=90,progress=0}={}){
  if(!Array.isArray(coordinates)||coordinates.length!==2||!coordinates.every(Number.isFinite))throw Error('Posición de globo incorrecta');
  return {coordinates:[...coordinates],bearing:Number.isFinite(bearing)?bearing:0,altitude:Math.max(32,Math.min(180,Number(altitude)||90)),progress:Math.max(0,Math.min(1,Number(progress)||0))};
}
export async function installBalloon3D(map,mapboxgl,{imageUrl='../perez.png'}={}){
  if(!mapboxgl?.MercatorCoordinate?.fromLngLat)throw Error('Mapbox 3D no está preparado');
  // Dynamically load Three only in satellite mode; free map does not pay its cost.
  const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
  let pose=balloonFlightPose({coordinates:map.getCenter().toArray()});
  let disposed=false,loaded=false;
  const layer={
    id:'vp-balloon-three-v2',type:'custom',renderingMode:'3d',
    onAdd(_map,gl){
      this.camera=new THREE.Camera();
      this.scene=new THREE.Scene();
      this.group=new THREE.Group();
      this.scene.add(this.group);
      const gold=new THREE.MeshStandardMaterial({color:'#bb8b45',metalness:.61,roughness:.34});
      const cream=new THREE.MeshStandardMaterial({color:'#f2dbab',metalness:.1,roughness:.77});
      const teal=new THREE.MeshStandardMaterial({color:'#2a777c',metalness:.22,roughness:.55});
      const soft=new THREE.MeshStandardMaterial({color:'#80a8a5',metalness:.23,roughness:.51});
      const rattan=new THREE.MeshStandardMaterial({color:'#80542e',roughness:.9});
      const ropeMat=new THREE.MeshStandardMaterial({color:'#e0c58e',roughness:.72});
      const amber=new THREE.MeshBasicMaterial({color:'#ffe5a0'});
      const add=(geo,mat,x,y,z,parent=this.group)=>{
        const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
      };
      // Voluminous fabric envelope: twelve shaped gores and brass ribs.
      const colors=[cream,cream,teal,teal,cream,soft,cream,teal,cream,soft,cream,teal];
      for(let i=0;i<12;i++){
        const g=new THREE.SphereGeometry(1,14,28,i*Math.PI/6,Math.PI/6+.008);
        const mesh=add(g,colors[i],0,21,0);
        mesh.scale.set(8.4,9.8,8.4);
      }
      // Optimized ribs: 12 curves instead of 240 individual cylinder draw calls.
      for(let i=0;i<12;i++){
        const rad=i*Math.PI/6+.002;
        const pts=[];
        for(let j=0;j<=20;j++){
          const a=Math.PI*(j/20);
          pts.push(new THREE.Vector3(8.45*Math.sin(a)*Math.sin(rad),21+9.85*Math.cos(a),8.45*Math.sin(a)*Math.cos(rad)));
        }
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.07,5,false),gold,0,0,0);
      }
      for(const h of [13,19,25]){
        const a=Math.acos((h-21)/9.8),radius=8.46*Math.sin(a);
        const ring=add(new THREE.TorusGeometry(radius,.105,6,60),gold,0,h,0);
        ring.rotation.x=Math.PI/2;
      }
      // Neck below envelope, four ropes, genuine modeled basket.
      const neck=add(new THREE.CylinderGeometry(2.8,2.35,2.7,12),gold,0,10.7,0);
      neck.material=teal;
      const basket=add(new THREE.CylinderGeometry(2.65,2.35,3.4,12),rattan,0,4.5,0);
      const rim=add(new THREE.TorusGeometry(2.65,.28,10,48),gold,0,6.3,0);rim.rotation.x=Math.PI/2;
      const base=add(new THREE.CylinderGeometry(2.35,2.35,.3,12),gold,0,2.7,0);
      for(const x of [-1.8,1.8])for(const z of [-1.65,1.65]){
        const a=new THREE.Vector3(x,6.1,z),b=new THREE.Vector3(x*2.25,14,z*2.1),d=new THREE.Vector3().subVectors(b,a);
        const m=add(new THREE.CylinderGeometry(.09,.09,d.length(),7),ropeMat,...new THREE.Vector3().addVectors(a,b).multiplyScalar(.5).toArray());
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
      }
      // Gentle warm basket lighting, physically attached to the model.
      const flame=add(new THREE.ConeGeometry(.65,1.5,11),amber,0,8.15,0);
      const lamp=new THREE.PointLight('#ffc76a',14,38,2);lamp.position.set(0,7.6,0);this.group.add(lamp);
      for(const x of [-2.4,2.4]){
        add(new THREE.SphereGeometry(.42,12,8),amber,x,6.1,0);
      }
      const hemi=new THREE.HemisphereLight('#bcdff3','#66533e',2.5);
      this.scene.add(hemi);
      const moon=new THREE.DirectionalLight('#d7e9ff',3.1);moon.position.set(-12,42,22);this.scene.add(moon);
      // Official Ratón Pérez PNG — original pixels, displayed on a flat plane.
      const texture=new THREE.TextureLoader().load(imageUrl,()=>_map.triggerRepaint(),undefined,()=>console.warn('Ratón PNG no disponible'));
      texture.colorSpace=THREE.SRGBColorSpace;
      const mouse=new THREE.Mesh(new THREE.PlaneGeometry(3.7,5),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
      mouse.position.set(0,6.05,2.65);
      this.group.add(mouse);
      this.mouse=mouse;
      // No vector shapes for the mouse: the original master is preserved exactly.
      this.renderer=new THREE.WebGLRenderer({canvas:_map.getCanvas(),context:gl,antialias:true,alpha:true});
      this.renderer.autoClear=false;
      this.gl=gl;
      loaded=true;
    },
    render(gl,matrix){
      if(disposed||!loaded)return;
      const coord=mapboxgl.MercatorCoordinate.fromLngLat(pose.coordinates,pose.altitude+Math.sin(performance.now()*.0007)*1.8);
      const scale=coord.meterInMercatorCoordinateUnits();
      const t=new THREE.Matrix4().makeTranslation(coord.x,coord.y,coord.z)
        .scale(new THREE.Vector3(scale,-scale,scale))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      this.camera.projectionMatrix=new THREE.Matrix4().fromArray(matrix).multiply(t);
      // Model built in metres with upward Y; subtle balloon sway & proper flight bearing.
      this.group.rotation.y=-pose.bearing*Math.PI/180;
      this.group.rotation.z=Math.sin(performance.now()*.00064)*.045;
      this.group.rotation.x=Math.sin(performance.now()*.00048)*.033;
      if(this.mouse){
        // The official 2D image always faces the camera as much as possible;
        // only the plane rotates, not the artwork itself.
        this.mouse.rotation.y=pose.bearing*Math.PI/180-map.getBearing()*Math.PI/180;
      }
      this.renderer.resetState();
      this.renderer.render(this.scene,this.camera);
      if(!disposed&&active)map.triggerRepaint();
    },
    onRemove(){
      disposed=true;loaded=false;
      this.scene?.traverse(obj=>{
        obj.geometry?.dispose?.();
        if(obj.material){
          for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
            mat.map?.dispose?.();mat.dispose?.();
          }
        }
      });
      this.renderer?.dispose?.();
    }
  };
  let active=false;
  if(map.getLayer(layer.id))map.removeLayer(layer.id);
  map.addLayer(layer);
  return {
    setPose(next){pose=balloonFlightPose(next);if(!disposed)map.triggerRepaint()},
    setActive(bool){active=Boolean(bool);if(active&&!disposed)map.triggerRepaint()},
    getPose(){return {...pose,coordinates:[...pose.coordinates]}},
    remove(){if(map.getLayer(layer.id))map.removeLayer(layer.id);disposed=true;}
  };
}
