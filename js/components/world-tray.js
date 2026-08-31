/* Quest-first spatial manipulation for Mira, the World Tray and scene objects. */
(function () {
  'use strict';
  if (typeof AFRAME === 'undefined') return;

  const CONTROLLERS = ['#lcontroller', '#rcontroller'];
  const HANDS = ['#lhand', '#rhand'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  AFRAME.registerComponent('world-tray', {
    schema: { minScale: { default: 0.45 }, maxScale: { default: 1.35 } },
    init() {
      this.scaleValue = this.el.object3D.scale.x || 0.72;
      window.addEventListener('wheel', (event) => {
        if (!event.shiftKey || !this.el.getAttribute('visible')) return;
        event.preventDefault();
        this.setScale(this.scaleValue + event.deltaY * -0.001);
      }, { passive: false });
      window.addEventListener('pocket-tray-reset', () => {
        this.el.object3D.position.set(-0.72, 0.5, -1.9);
        this.setScale(0.72, false);
        this.setVisible(false, false);
        this.emitTransform();
      });
      window.addEventListener('pocket-tray-visibility', (event) => this.setVisible(!!event.detail?.visible));
    },
    setScale(value, emit = true) {
      this.scaleValue = clamp(Number(value) || 0.72, this.data.minScale, this.data.maxScale);
      this.el.object3D.scale.setScalar(this.scaleValue);
      if (emit) this.emitTransform();
    },
    setVisible(visible, emit = true) {
      this.el.setAttribute('visible', !!visible);
      if (emit) this.emitTransform();
    },
    emitTransform() {
      const p = this.el.object3D.position;
      window.dispatchEvent(new CustomEvent('pocket-tray-transform', { detail: {
        position: [p.x, p.y, p.z], rotation: [0, 0, 0], scale: this.scaleValue,
        visible: this.el.getAttribute('visible') !== false
      } }));
    }
  });

  AFRAME.registerComponent('scene-grab-system', {
    init() {
      this.grab = null;
      this.mouseGrab = null;
      this.ray = new THREE.Raycaster();
      this.origin = new THREE.Vector3();
      this.direction = new THREE.Vector3();
      this.quaternion = new THREE.Quaternion();
      this.tmp = new THREE.Vector3();
      this.tmp2 = new THREE.Vector3();
      this.ndc = new THREE.Vector2();
      this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this.stepAnimation = null;

      CONTROLLERS.forEach((selector) => {
        const controller = document.querySelector(selector);
        if (!controller) return;
        controller.addEventListener('gripdown', () => this.startRayGrab(controller));
        controller.addEventListener('gripup', () => this.release(controller));
        controller.addEventListener('triggerdown', () => this.selectWithRay(controller));
        controller.addEventListener('thumbstickmoved', (event) => this.adjustGrab(controller, event.detail || {}));
      });
      HANDS.forEach((selector) => {
        const hand = document.querySelector(selector);
        if (!hand) return;
        hand.addEventListener('pinchstarted', () => this.startDirectGrab(hand));
        hand.addEventListener('pinchended', () => this.release(hand));
      });

      window.addEventListener('mousedown', (event) => this.mouseDown(event));
      window.addEventListener('mousemove', (event) => this.mouseMove(event));
      window.addEventListener('mouseup', () => this.mouseUp());
      window.addEventListener('pocket-avatar-step', (event) => this.stepAvatar(Number(event.detail?.distance) || 0.28));
    },

    targets() {
      return Array.from(document.querySelectorAll('.xr-grabbable')).filter((el) => {
        if (!el.object3D || el.object3D.visible === false) return false;
        const tray = el.dataset.xrRole === 'tray' ? el : el.closest?.('#world-tray');
        return !tray || tray.getAttribute('visible') !== false;
      });
    },
    role(el) { return el?.dataset?.xrRole || (el?.classList?.contains('scene-object') ? 'object' : 'unknown'); },
    rootForObject(object) {
      let cursor = object;
      while (cursor) {
        let el = cursor.el;
        while (el) {
          if (el.classList?.contains('xr-grabbable')) return el;
          el = el.parentElement;
        }
        cursor = cursor.parent;
      }
      return null;
    },
    targetCenter(el, out) {
      el.object3D.getWorldPosition(out);
      if (this.role(el) === 'avatar') out.y += 0.82 * el.object3D.scale.y;
      return out;
    },
    controllerRay(controller) {
      controller.object3D.getWorldPosition(this.origin);
      controller.object3D.getWorldQuaternion(this.quaternion);
      this.direction.set(0, 0, -1).applyQuaternion(this.quaternion).normalize();
      this.ray.set(this.origin, this.direction);
      return this.ray;
    },
    pickRay(controller) {
      const targets = this.targets();
      if (!targets.length) return null;
      const ray = this.controllerRay(controller);
      const hits = ray.intersectObjects(targets.map((el) => el.object3D), true);
      for (const hit of hits) {
        const target = this.rootForObject(hit.object);
        if (target) return { target, distance: hit.distance, point: hit.point.clone() };
      }
      // Proxy meshes differ across A-Frame/Quest builds. Use a forgiving aim
      // fallback so Grip remains useful even if the transparent proxy is skipped.
      let best = null;
      for (const target of targets) {
        const center = this.targetCenter(target, this.tmp);
        const projection = this.tmp2.copy(center).sub(this.origin).dot(this.direction);
        if (projection < 0.35 || projection > 6) continue;
        const point = this.direction.clone().multiplyScalar(projection).add(this.origin);
        const distance = point.distanceTo(center);
        const threshold = this.role(target) === 'avatar' ? 0.62 : this.role(target) === 'tray' ? 0.85 : 0.26;
        if (distance <= threshold && (!best || distance < best.aimError)) best = { target, distance: projection, point, aimError: distance };
      }
      return best;
    },
    selectWithRay(controller) {
      const picked = this.pickRay(controller);
      if (!picked) return this.feedback('射线没有指向可操作的对象');
      if (this.role(picked.target) === 'object') {
        window.dispatchEvent(new CustomEvent('pocket-select', { detail: { instanceId: picked.target.dataset.instanceId } }));
      }
      this.feedback(`已选中${this.label(picked.target)}`);
      this.pulse(controller);
    },
    startRayGrab(controller) {
      if (this.grab) return;
      const picked = this.pickRay(controller);
      if (!picked) return this.feedback('用手柄射线指向 Mira、托盘或物件，再按住 Grip');
      const targetWorld = picked.target.object3D.getWorldPosition(this.tmp).clone();
      const anchor = this.controllerRay(controller).ray.at(clamp(picked.distance, 0.45, 5.5), this.tmp2).clone();
      this.grab = {
        source: controller, direct: false, target: picked.target, role: this.role(picked.target),
        distance: clamp(picked.distance, 0.45, 5.5), offset: targetWorld.sub(anchor)
      };
      controller.dataset.pocketObjectGrab = '1';
      if (this.grab.role === 'object') window.dispatchEvent(new CustomEvent('pocket-select', { detail: { instanceId: picked.target.dataset.instanceId } }));
      this.feedback(`正在移动${this.label(picked.target)}；摇杆上下调距离`);
      this.pulse(controller);
    },
    startDirectGrab(hand) {
      if (this.grab) return;
      hand.object3D.getWorldPosition(this.origin);
      let best = null;
      for (const target of this.targets()) {
        const center = this.targetCenter(target, this.tmp);
        const distance = center.distanceTo(this.origin);
        const threshold = this.role(target) === 'avatar' ? 0.48 : this.role(target) === 'tray' ? 0.55 : 0.24;
        if (distance <= threshold && (!best || distance < best.distance)) best = { target, distance };
      }
      if (!best) return;
      const targetWorld = best.target.object3D.getWorldPosition(this.tmp).clone();
      this.grab = { source: hand, direct: true, target: best.target, role: this.role(best.target), distance: best.distance, offset: targetWorld.sub(this.origin) };
      hand.dataset.pocketObjectGrab = '1';
      if (this.grab.role === 'object') window.dispatchEvent(new CustomEvent('pocket-select', { detail: { instanceId: best.target.dataset.instanceId } }));
      this.feedback(`正在移动${this.label(best.target)}`);
    },
    adjustGrab(controller, detail) {
      if (!this.grab || this.grab.source !== controller || this.grab.direct) return;
      if (Math.abs(detail.y || 0) > 0.18) this.grab.distance = clamp(this.grab.distance - detail.y * 0.13, 0.45, 5.5);
      if (Math.abs(detail.x || 0) > 0.5 && this.grab.role !== 'avatar') this.grab.target.object3D.rotation.y -= detail.x * 0.045;
    },
    placeAtWorld(target, role, world) {
      if (role === 'object') {
        const tray = document.querySelector('#world-tray');
        if (!tray) return;
        const local = tray.object3D.worldToLocal(world.clone());
        target.object3D.position.set(clamp(local.x, -0.86, 0.86), clamp(local.y, 0.02, 0.65), clamp(local.z, -0.56, 0.56));
        return;
      }
      const parent = target.object3D.parent;
      const local = parent ? parent.worldToLocal(world.clone()) : world;
      if (role === 'avatar') target.object3D.position.set(clamp(local.x, -4, 4), 0, clamp(local.z, -5, 0.15));
      else if (role === 'tray') target.object3D.position.set(clamp(local.x, -3, 3), clamp(local.y, 0.25, 1.25), clamp(local.z, -4.5, -0.45));
    },
    release(source) {
      if (!this.grab || this.grab.source !== source) return;
      const { target, role } = this.grab;
      delete source.dataset.pocketObjectGrab;
      this.grab = null;
      this.emitTransform(target, role);
      this.feedback(`已放置${this.label(target)}`);
      this.pulse(source);
    },
    emitTransform(target, role) {
      const p = target.object3D.position;
      const r = target.object3D.rotation;
      const s = target.object3D.scale;
      if (role === 'object') window.dispatchEvent(new CustomEvent('pocket-manual-transform', { detail: {
        instanceId: target.dataset.instanceId, position: [p.x, p.y, p.z],
        rotation: [THREE.MathUtils.radToDeg(r.x), THREE.MathUtils.radToDeg(r.y), THREE.MathUtils.radToDeg(r.z)], scale: [s.x, s.y, s.z]
      } }));
      if (role === 'tray') window.dispatchEvent(new CustomEvent('pocket-tray-transform', { detail: {
        position: [p.x, p.y, p.z], rotation: [0, THREE.MathUtils.radToDeg(r.y), 0], scale: s.x, visible: target.getAttribute('visible') !== false
      } }));
      if (role === 'avatar') window.dispatchEvent(new CustomEvent('pocket-avatar-transform', { detail: {
        position: [p.x, 0, p.z], rotation: [0, THREE.MathUtils.radToDeg(r.y), 0], scale: s.x, visible: target.getAttribute('visible') !== false
      } }));
    },
    label(target) {
      const role = this.role(target);
      return role === 'avatar' ? ' Mira' : role === 'tray' ? '世界托盘' : '场景物件';
    },
    feedback(text) { window.dispatchEvent(new CustomEvent('pocket-xr-feedback', { detail: { text } })); },
    pulse(controller) {
      try {
        const gamepad = controller.components?.['tracked-controls']?.controller?.gamepad;
        gamepad?.hapticActuators?.[0]?.pulse?.(0.35, 45);
      } catch { /* haptics are optional */ }
    },

    mouseRay(event) {
      const canvas = this.el.sceneEl.canvas;
      const camera = this.el.sceneEl.camera;
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      this.ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, camera);
      const hits = this.ray.intersectObjects(this.targets().map((el) => el.object3D), true);
      for (const hit of hits) {
        const target = this.rootForObject(hit.object);
        if (target) return { target, point: hit.point.clone() };
      }
      return null;
    },
    mouseDown(event) {
      if (event.target !== this.el.sceneEl.canvas) return;
      const picked = this.mouseRay(event);
      if (!picked) return;
      const role = this.role(picked.target);
      if (role === 'tray' && !event.shiftKey) return;
      if (role !== 'tray' && event.shiftKey) return;
      const targetWorld = picked.target.object3D.getWorldPosition(this.tmp).clone();
      this.floorPlane.constant = -picked.point.y;
      this.mouseGrab = { target: picked.target, role, offset: targetWorld.sub(picked.point) };
      if (role === 'object') window.dispatchEvent(new CustomEvent('pocket-select', { detail: { instanceId: picked.target.dataset.instanceId } }));
      event.preventDefault();
    },
    mouseMove(event) {
      if (!this.mouseGrab || !this.el.sceneEl.camera) return;
      const canvas = this.el.sceneEl.canvas;
      const rect = canvas.getBoundingClientRect();
      this.ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.el.sceneEl.camera);
      if (this.ray.ray.intersectPlane(this.floorPlane, this.tmp)) this.placeAtWorld(this.mouseGrab.target, this.mouseGrab.role, this.tmp.add(this.mouseGrab.offset));
    },
    mouseUp() {
      if (!this.mouseGrab) return;
      this.emitTransform(this.mouseGrab.target, this.mouseGrab.role);
      this.mouseGrab = null;
    },

    stepAvatar(distance) {
      const avatar = document.querySelector('#mira-avatar');
      const camera = this.el.sceneEl.camera;
      if (!avatar || !camera || this.stepAnimation) return;
      avatar.object3D.getWorldPosition(this.origin);
      camera.getWorldPosition(this.tmp);
      const direction = this.tmp2.copy(this.tmp).sub(this.origin);
      direction.y = 0;
      const currentDistance = direction.length();
      if (currentDistance < 0.01) return;
      direction.normalize();
      let amount = distance;
      if (amount > 0) amount = Math.min(amount, Math.max(0, currentDistance - 0.78));
      if (!amount) return this.feedback('Mira 已经很靠近了');
      const start = avatar.object3D.position.clone();
      const worldTarget = this.origin.clone().addScaledVector(direction, amount);
      const parent = avatar.object3D.parent;
      const end = parent ? parent.worldToLocal(worldTarget) : worldTarget;
      end.x = clamp(end.x, -4, 4); end.y = 0; end.z = clamp(end.z, -5, 0.15);
      this.stepAnimation = { avatar, start, end, started: performance.now() };
      this.feedback(amount > 0 ? 'Mira 正在靠近你' : 'Mira 正在退后');
    },
    updateStep(time) {
      if (!this.stepAnimation) return;
      const animation = this.stepAnimation;
      const raw = clamp((time - animation.started) / 650, 0, 1);
      const eased = raw * raw * (3 - 2 * raw);
      animation.avatar.object3D.position.lerpVectors(animation.start, animation.end, eased);
      animation.avatar.object3D.position.y += Math.sin(raw * Math.PI) * 0.025;
      if (raw >= 1) {
        animation.avatar.object3D.position.copy(animation.end);
        this.stepAnimation = null;
        this.emitTransform(animation.avatar, 'avatar');
      }
    },
    tick(time) {
      this.updateStep(time || performance.now());
      if (!this.grab) return;
      let anchor;
      if (this.grab.direct) {
        this.grab.source.object3D.getWorldPosition(this.tmp);
        anchor = this.tmp;
      } else {
        this.controllerRay(this.grab.source);
        anchor = this.ray.ray.at(this.grab.distance, this.tmp);
      }
      this.placeAtWorld(this.grab.target, this.grab.role, anchor.clone().add(this.grab.offset));
    }
  });
})();
