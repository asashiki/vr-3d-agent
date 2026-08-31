/* World Tray and scene-object direct manipulation for desktop, controllers and hand pinch. */
(function () {
  if (typeof AFRAME === 'undefined') return;
  AFRAME.registerComponent('world-tray', {
    schema: { minScale: { default: .55 }, maxScale: { default: 1.6 } },
    init() {
      this.scaleValue = 1;
      this.el.addEventListener('wheel', (event) => {
        event.preventDefault();
        this.setScale(this.scaleValue + (event.detail?.deltaY || event.deltaY) * -.001);
      });
      ['#lhand','#rhand'].forEach((selector) => {
        const hand = document.querySelector(selector);
        if (!hand) return;
        hand.addEventListener('thumbstickmoved', (event) => {
          if (Math.abs(event.detail.y) > .55) this.setScale(this.scaleValue + event.detail.y * -.025);
        });
      });
      window.addEventListener('pocket-tray-reset', () => {
        this.el.setAttribute('position', '0 .72 -1.8'); this.setScale(1); this.emitTransform();
      });
    },
    setScale(value) {
      this.scaleValue = Math.max(this.data.minScale, Math.min(this.data.maxScale, value));
      this.el.object3D.scale.setScalar(this.scaleValue); this.emitTransform();
    },
    emitTransform() {
      const p = this.el.object3D.position;
      window.dispatchEvent(new CustomEvent('pocket-tray-transform', { detail: { position:[p.x,p.y,p.z], scale:this.scaleValue } }));
    }
  });

  AFRAME.registerComponent('scene-grab-system', {
    init() {
      this.mouseGrab = null; this.handGrab = null;
      this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2(); this.tmp = new THREE.Vector3();
      this.plane = new THREE.Plane(new THREE.Vector3(0,1,0), -.76);
      window.addEventListener('mousedown', (event) => this.mouseDown(event));
      window.addEventListener('mousemove', (event) => this.mouseMove(event));
      window.addEventListener('mouseup', () => this.mouseUp());
      ['#lhand','#rhand'].forEach((selector) => {
        const hand = document.querySelector(selector); if (!hand) return;
        hand.addEventListener('gripdown', () => this.handDown(hand)); hand.addEventListener('gripup', () => this.handUp(hand));
        hand.addEventListener('pinchstarted', () => this.handDown(hand)); hand.addEventListener('pinchended', () => this.handUp(hand));
      });
    },
    targets() { return Array.from(document.querySelectorAll('.scene-object')); },
    entityFor(object) { let cursor=object; while(cursor){if(cursor.el?.classList?.contains('scene-object')) return cursor.el;cursor=cursor.parent;} return null; },
    setNdc(event) {
      const rect=this.el.sceneEl.canvas.getBoundingClientRect();
      this.ndc.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    },
    mouseDown(event) {
      if (event.target !== this.el.sceneEl.canvas || !this.el.sceneEl.camera) return;
      this.setNdc(event); this.ray.setFromCamera(this.ndc,this.el.sceneEl.camera);
      const hit=this.ray.intersectObjects(this.targets().map((el)=>el.object3D),true)[0];
      const entity=hit && this.entityFor(hit.object); if(!entity) return;
      this.mouseGrab=entity; window.dispatchEvent(new CustomEvent('pocket-select',{detail:{instanceId:entity.dataset.instanceId}}));
    },
    mouseMove(event) {
      if(!this.mouseGrab||!this.el.sceneEl.camera) return;
      this.setNdc(event); this.ray.setFromCamera(this.ndc,this.el.sceneEl.camera);
      if(this.ray.ray.intersectPlane(this.plane,this.tmp)){
        const tray=document.querySelector('#world-tray');
        const local=tray.object3D.worldToLocal(this.tmp.clone());
        this.mouseGrab.object3D.position.x=Math.max(-.86,Math.min(.86,local.x));
        this.mouseGrab.object3D.position.z=Math.max(-.56,Math.min(.56,local.z));
      }
    },
    mouseUp() { if(this.mouseGrab){this.emitDrop(this.mouseGrab);this.mouseGrab=null;} },
    handDown(hand) {
      hand.object3D.getWorldPosition(this.tmp); let best=null,bestDistance=.22;
      for(const entity of this.targets()){const p=new THREE.Vector3();entity.object3D.getWorldPosition(p);const d=p.distanceTo(this.tmp);if(d<bestDistance){best=entity;bestDistance=d;}}
      if(best){this.handGrab={hand,entity:best};window.dispatchEvent(new CustomEvent('pocket-select',{detail:{instanceId:best.dataset.instanceId}}));}
    },
    handUp(hand) { if(this.handGrab?.hand===hand){this.emitDrop(this.handGrab.entity);this.handGrab=null;} },
    emitDrop(entity) {
      const p=entity.object3D.position, r=entity.object3D.rotation, s=entity.object3D.scale;
      window.dispatchEvent(new CustomEvent('pocket-manual-transform',{detail:{instanceId:entity.dataset.instanceId,position:[p.x,p.y,p.z],rotation:[THREE.MathUtils.radToDeg(r.x),THREE.MathUtils.radToDeg(r.y),THREE.MathUtils.radToDeg(r.z)],scale:[s.x,s.y,s.z]}}));
    },
    tick() {
      if(!this.handGrab) return;
      this.handGrab.hand.object3D.getWorldPosition(this.tmp);
      const tray=document.querySelector('#world-tray'); const local=tray.object3D.worldToLocal(this.tmp.clone());
      this.handGrab.entity.object3D.position.set(Math.max(-.86,Math.min(.86,local.x)),Math.max(.02,local.y),Math.max(-.56,Math.min(.56,local.z)));
    }
  });
})();
