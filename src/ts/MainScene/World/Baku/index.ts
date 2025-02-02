import * as THREE from 'three';
import * as ORE from 'ore-three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { PowerMesh } from 'power-mesh';

import bakuFrag from './shaders/baku.fs';
import bakuVert from './shaders/baku.vs';
import passThroughFrag from './shaders/passThrough.fs';

export type BakuMaterialType = 'normal' | 'glass' | 'line' | 'dark';

export class Baku extends THREE.Object3D {
    // Animation properties with proper initialization
    private animator: ORE.Animator = window.gManager.animator;
    private animationMixer: THREE.AnimationMixer | null = null;
    private currentAnimationSection: string | null = null;
    private animationClipNameList: string[] = [];
    private animationActions: { [name: string]: THREE.AnimationAction } = {};
    private playingSectionAction: THREE.AnimationAction | null = null;

    // Core properties initialization
    private manager: THREE.LoadingManager;
    private commonUniforms: ORE.Uniforms;
    private container: THREE.Object3D;
    private mesh: PowerMesh | null = null;
    protected meshLine: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
    private passThrough: ORE.PostProcessing | null = null;
    public sceneRenderTarget: THREE.WebGLRenderTarget;
    public onLoaded?: () => void;

	//bakuWrap
	private bakuWrap?: THREE.Object3D

	//jumping
	private jumping: boolean = false;

    // Animation mapping
    private readonly SECTION_ANIMATIONS: { [key: string]: string } = {
        'section_1': '01_Walk',
        'section_2': '01_Walk',
        'section_3': '03_Floating',
        'section_4': '05_Hero',
        'section_5': '03_Floating',
        'section_6': '10_Flying',
		'pre_section_3': '03_Floating',
    };

    constructor(manager: THREE.LoadingManager, parentUniforms: ORE.Uniforms) {
        super();

        this.manager = manager;
        this.commonUniforms = ORE.UniformsLib.mergeUniforms(parentUniforms, {
            uSceneTex: { value: null },
            uNoiseTex: window.gManager.assetManager.getTex('noise'),
            winResolution: { value: new THREE.Vector2() }
        });

        // Initialize container
        this.container = new THREE.Object3D();
        this.add(this.container);

        // Initialize render target
        this.sceneRenderTarget = new THREE.WebGLRenderTarget(1, 1);

        this.initializeAnimator();
        this.loadModel();
    }

    private initializeAnimator() {
        // Basic property animations
        this.commonUniforms.uTransparent = this.animator.add({
            name: 'bakuTransparent',
            initValue: 0,
            easing: ORE.Easings.easeOutCubic
        });

        this.commonUniforms.uLine = this.animator.add({
            name: 'bakuLine',
            initValue: 0,
            easing: ORE.Easings.easeOutCubic
        });

        this.commonUniforms.uRimLight = this.animator.add({
            name: 'bakuRimLight',
            initValue: 1,
            easing: ORE.Easings.easeOutCubic
        });

        // Rotation animations
        this.animator.add({
            name: 'bakuIntroRotate',
            initValue: 1,
            easing: ORE.Easings.easeOutCubic
        });

        this.animator.add({
            name: 'bakuRotateSpeed',
            initValue: 0.0
        });

        this.animator.add({
            name: 'bakuRotateValue',
            initValue: 0,
            easing: ORE.Easings.easeOutCubic
        });
    }

		private loadModel() {
			const loader = new GLTFLoader(this.manager);
			loader.load('./assets/scene/SM_Character_Final.glb', (gltf) => {
				this.bakuWrap = gltf.scene.getObjectByName("Main_Rig") as THREE.Object3D;
				let bakuSing = gltf.scene.getObjectByName("Mesh003_7") as THREE.Mesh;

				let loaderText = new THREE.TextureLoader();

				loaderText.load('./assets/textures/music.png', (tex) => {
					// Create a new material with the texture if it doesn't exist
					if (!bakuSing.material) {
						bakuSing.material = new THREE.MeshStandardMaterial();
					}
					
					// If the material is an array, apply to all materials
					if (Array.isArray(bakuSing.material)) {
						bakuSing.material.forEach(mat => {
							if (mat instanceof THREE.MeshStandardMaterial || 
								mat instanceof THREE.MeshBasicMaterial ||
								mat instanceof THREE.MeshPhongMaterial) {
								mat.map = tex;
								mat.needsUpdate = true;
							}
						});
					} else {
						// Apply to single material with proper type casting
						if (bakuSing.material instanceof THREE.MeshStandardMaterial || 
							bakuSing.material instanceof THREE.MeshBasicMaterial ||
							bakuSing.material instanceof THREE.MeshPhongMaterial) {
							bakuSing.material.map = tex;
							bakuSing.material.needsUpdate = true;
						}
					}
				});

				// Scale down the model
				this.bakuWrap.scale.set(0.3, 0.3, 0.3);

				// Center the model
				const box = new THREE.Box3().setFromObject(this.bakuWrap);
				const center = box.getCenter(new THREE.Vector3());
				
				this.bakuWrap.position.x = -center.x;
				this.bakuWrap.position.y = -center.y;
				this.bakuWrap.position.z = -center.z;

				// Adjust the vertical position if needed
				this.bakuWrap.position.y -= 0;

				// console.log(this.bakuWrap.position, "checking the position");
				// console.log({
				// 	x: THREE.MathUtils.radToDeg(this.bakuWrap.rotation.x),
				// 	y: THREE.MathUtils.radToDeg(this.bakuWrap.rotation.y),
				// 	z: THREE.MathUtils.radToDeg(this.bakuWrap.rotation.z)
				// }, "Checking the rotation (Degrees)");

				if (this.bakuWrap) {
					this.container.add(this.bakuWrap);
					this.setupMeshes(this.bakuWrap);
					this.setupAnimations(gltf.animations);
					this.changeSectionAction('section_1');
				}

				if (this.onLoaded) {
					this.onLoaded();
				}
			});
		}

    private setupMeshes(bakuWrap: THREE.Object3D) {
        const mainMesh = bakuWrap.getObjectByName('Character') as THREE.Mesh;
        if (!mainMesh) return;

        // Setup main mesh
        this.mesh = new PowerMesh(mainMesh, {
            fragmentShader: bakuFrag,
            vertexShader: bakuVert,
            uniforms: this.commonUniforms,
        }, true);

        this.mesh.castShadow = true;
        this.mesh.renderOrder = 2;

        this.mesh.onBeforeRender = (renderer) => {
            if (!this.passThrough) {
                this.passThrough = new ORE.PostProcessing(renderer, {
                    fragmentShader: passThroughFrag,
                });
            }

            const currentRenderTarget = renderer.getRenderTarget();
            if (currentRenderTarget) {
                this.passThrough.render({ tex: currentRenderTarget.texture }, this.sceneRenderTarget);
                this.commonUniforms.uSceneTex.value = this.sceneRenderTarget.texture;
            }
        };

        // Setup line mesh
        const lineMat = new THREE.ShaderMaterial({
            vertexShader: bakuVert,
            fragmentShader: bakuFrag,
            uniforms: ORE.UniformsLib.mergeUniforms(this.commonUniforms, {}),
            side: THREE.BackSide,
            depthWrite: false,
            transparent: true,
            defines: { IS_LINE: '' }
        });

        this.meshLine = new THREE.SkinnedMesh(this.mesh.geometry, lineMat);
        this.meshLine.skeleton = this.mesh.skeleton;
    }

    private setupAnimations(animations: THREE.AnimationClip[]) {
        this.animationMixer = new THREE.AnimationMixer(this);

        animations.forEach(clip => {
            // Store the clip name
            this.animationClipNameList.push(clip.name);

            // Create weight animator
            this.animator.add({
                name: "BakuWeight/" + clip.name,
                initValue: 1,
                easing: ORE.Easings.easeOutCubic
            });

            // Create and store the action
			if(this.animationMixer) {
				const action = this.animationMixer.clipAction(clip);
				this.animationActions[clip.name] = action;
			}

        });

        // Initialize current section if set
        if (this.currentAnimationSection) {
            this.changeSectionAction(this.currentAnimationSection);
        }
    }


	public changeSectionAction(sectionName: string, pre?: string) {
	
		const animationName = pre ? this.SECTION_ANIMATIONS[pre] : this.SECTION_ANIMATIONS[sectionName];
		if (!animationName || !this.animationActions[animationName]) {
			console.error(`Animation not found: ${animationName}`);
			return;
		}
	
	
		const action = this.animationActions[animationName];
		const lastSectionAction = this.playingSectionAction;
		this.playingSectionAction = action;
	
		// If there's a pre-animation specified
		if (sectionName === 'section_3' && pre === 'pre_section_3') {



			this.animationClipNameList.forEach(name => {
				if (name !== animationName && name !== lastSectionAction?.getClip().name) {
					const otherAction = this.animationActions[name];
					if (otherAction.isRunning()) {
						otherAction.stop();
					}
				}
		
				this.animator.animate(
					'BakuWeight/' + name,
					name === animationName ? 1 : 0,
					1.0, // Adjust this value for smoother weight transition
					() => {
						if (name !== animationName && this.animationActions[name].isRunning()) {
							this.animationActions[name].stop();
						}
					}
				);
			});			

	
			// Reset and play the floating animation
			action.reset()
				.setEffectiveTimeScale(1)
				.setEffectiveWeight(1)
				.play();
	
			// Calculate the exact duration in milliseconds
			const duration = action.getClip().duration * 500; // Use 1000 for normal duration
	
			// Use setTimeout to trigger the walking animation after floating completes
			setTimeout(() => {
				action.stop();	
				// Trigger the walking animation
				// this.changeAngleandPosition([['x', 39]], [0, -0.6, 0]);
				this.changeSectionAction(sectionName);
			}, duration);
	
			return; // Exit early as we'll handle the main animation after the timeout
		}
	
		// If there's a previous animation playing
		if (lastSectionAction && lastSectionAction !== action) {
			// Synchronize the new animation with the current one
			const currentTime = lastSectionAction.time;
			const duration = lastSectionAction.getClip().duration;
			const phase = currentTime / duration;
	
			// Set the new animation to the same relative point
			const newDuration = action.getClip().duration;
			action.time = phase * newDuration;
	
			// Enable smooth crossfading
			action.reset()
				.setEffectiveTimeScale(1)
				.setEffectiveWeight(0)
				.play();
	
			// Crossfade duration in seconds
			const crossFadeDuration = 1.0; // Adjust this value for smoother transition
	
			// Perform the crossfade
			action.crossFadeFrom(lastSectionAction, crossFadeDuration, true);
		} else {
			// If it's the first animation, just play it
			action
				.setEffectiveTimeScale(1)
				.setEffectiveWeight(1)
				.play();
		}
	
		// Update weights for smooth blending
		this.animationClipNameList.forEach(name => {
			if (name !== animationName && name !== lastSectionAction?.getClip().name) {
				const otherAction = this.animationActions[name];
				if (otherAction.isRunning()) {
					otherAction.stop();
				}
			}
	
			this.animator.animate(
				'BakuWeight/' + name,
				name === animationName ? 1 : 0,
				1.0, // Adjust this value for smoother weight transition
				() => {
					if (name !== animationName && this.animationActions[name].isRunning()) {
						this.animationActions[name].stop();
					}
				}
			);
		});
	
		this.currentAnimationSection = sectionName;
	}

    public changeMaterial(type: BakuMaterialType) {
        this.animator.animate('bakuTransparent', type === 'glass' ? 1 : 0, 1);
        this.animator.animate('bakuLine', type === 'line' ? 1 : 0, 1);
        this.animator.animate('bakuRimLight', type === 'dark' ? 0.0 : 1.0);
    }

    // public changeRotateSpeed(speed: number) {
    //     if (speed === 0.0) {
    //         this.animator.setValue('bakuRotateSpeed', 0);
    //         this.animator.setValue(
    //             'bakuRotateValue',
    //             (this.container.rotation.z + Math.PI) % (Math.PI * 2.0) - Math.PI
    //         );
    //         this.animator.animate('bakuRotateValue', 0);
    //         return;
    //     }

    //     this.animator.animate('bakuRotateSpeed', speed);
    // }

    public show(duration: number = 1.0) {
        this.animator.animate('bakuIntroRotate', 0, duration);
    }

    public update(deltaTime: number) {
        if (this.animationMixer) {
            this.animationMixer.update(deltaTime);

            this.animationClipNameList.forEach(name => {
                const action = this.animationActions[name];
                if (action) {
                    action.weight = this.animator.get('BakuWeight/' + name) || 0;
                }
            });
        }

        if (this.mesh) {
            this.rotation.z -= (this.animator.get<number>('bakuIntroRotate') ?? 0) * 3.0;
        }

        if (!this.animator.isAnimatingVariable('bakuRotateValue')) {
            const currentValue = this.animator.get<number>('bakuRotateValue') ?? 0;
            const speed = this.animator.get<number>('bakuRotateSpeed') ?? 0;
            this.animator.setValue("bakuRotateValue", currentValue + speed * deltaTime);
        }

        this.container.rotation.z = this.animator.get<number>('bakuRotateValue') ?? 0;
    }

    public resize(info: ORE.LayerInfo) {
        this.sceneRenderTarget.setSize(
            info.size.canvasPixelSize.x,
            info.size.canvasPixelSize.y
        );
        this.commonUniforms.winResolution.value.copy(info.size.canvasPixelSize);
    }


	public resetToInitialPosition(sectionName: string) {
		if (!this.bakuWrap) return;

		if(sectionName == 'section_2' || sectionName == 'section_6') return;

		// Reset rotation properly
		this.bakuWrap.rotation.set(0, 0, 0);
		this.bakuWrap.updateMatrix();
	
		// Reset position
		this.bakuWrap.position.set(0, -0.34057440161705016, -0.010594895482063285);
	}

	public changeAngleandPosition(
		rotations?: (['x' | 'y' | 'z', number])[], // Array of axis-angle pairs
		position?: [number, number, number]) 
	{
		if (!this.bakuWrap) return;
	
		if (rotations) {
			rotations.forEach(([axis, angle]) => {
				const axisVector = new THREE.Vector3(
					axis === 'x' ? 1 : 0,
					axis === 'y' ? 1 : 0,
					axis === 'z' ? 1 : 0
				).normalize();
	           
				if(this.bakuWrap)
				this.bakuWrap.setRotationFromAxisAngle(axisVector, THREE.MathUtils.degToRad(angle));
			});
		}
	
		// Move the model
		if(position) {
			this.bakuWrap.position.set(position[0], position[1], position[2]);
		}
		// console.log(this.bakuWrap.position, "checking the position two update");
	}




	public jump() {

		if ( this.jumping ) return;

		this.jumping = true;

		let action = this.animationActions["05_Hero"];
		action.reset();
		action.loop = THREE.LoopOnce;
		action.play();

		// Add the "BakuWeight/" prefix to match how they were created
		this.animator.animate('BakuWeight/03_Floating', 1, 2);
		this.animator.animate('BakuWeight/08_Shockwave', 1.0, 0.1);

		if ( this.animationMixer ) {

			let onFinished = ( e: any ) => {

				let action = e.action as THREE.AnimationAction;
				let clip = action.getClip();

				if ( clip.name == '05_Hero' ) {


					console.log('Lets observe where we are', clip);
					
					// Add the "BakuWeight/" prefix here too
					// this.bakuWrap?.position.set(0, -0.74057440161705016, -0.010594895482063285);
					this.animator.animate('BakuWeight/03_Floating', 1.0, 1.0);
					this.animator.animate('BakuWeight/08_Shockwave', 1, 1.5);


					this.jumping = false;

					if ( this.animationMixer ) {

						this.animationMixer.addEventListener( 'finished', onFinished );

					}

				}

			};

			this.animationMixer.addEventListener( 'finished', onFinished );

		}

		this.dispatchEvent( {
			type: 'jump'
		} );

	}
}