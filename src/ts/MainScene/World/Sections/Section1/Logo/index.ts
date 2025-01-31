import * as ORE from 'ore-three';
import * as THREE from 'three';

import { LogoPart } from './LogoPart';

export class Logo {

	private animator: ORE.Animator;

	private commonUniforms: ORE.Uniforms;
	private root: THREE.Object3D;
	private meshList: LogoPart[] = [];

	constructor( root: THREE.Object3D, parentUniforms: ORE.Uniforms ) {

		this.root = root;

		this.commonUniforms = ORE.UniformsLib.mergeUniforms( parentUniforms, {} );

		/*-------------------------------
			Animator
		-------------------------------*/

		this.animator = window.gManager.animator;

		this.commonUniforms.uVisibility = this.animator.add( {
			name: 'sec1LogoVisibility',
			initValue: 0,
			easing: ORE.Easings.linear
		} );

		// Handle groups instead of direct meshes
		this.root.children.forEach((group, index) => {
			if (group.type === 'Group') {
				// Find all meshes within the group
				group.traverse((child) => {
					if (child.type === 'Mesh') {
						let mesh = child as THREE.Mesh;
						let part = new LogoPart(
							mesh, 
							index / this.root.children.length, 
							this.commonUniforms
						);
						this.meshList.push(part);

						this.meshList.forEach(part => {
							part.updateMaterialProperties({
								metalness: 0.8,    // Higher for more metallic look
								roughness: 0.1,    // Lower for smoother surface
								glossiness: 0.95,  // Higher for more shine
								reflection: 0.7    // Higher for more reflections
							});
						});

					}
				});
			}
		});

		//handle meshes
		


		// Update position assignments to target the group names instead
		const positionMap = {
			'LogoPart_1': new THREE.Vector3(1, 1.3, 0.0),
			'LogoPart_2': new THREE.Vector3(1.5, 0.3, 0.0),
			'LogoPart_3': new THREE.Vector3(-0.7, 0.5, 0.0),
			'LogoPart_4': new THREE.Vector3(-1.5, -2.3, 0.0),
			'LogoPart_5': new THREE.Vector3(-2.0, -3.0, 0.0)
		};


	
		// Apply transforms to all meshes within each group
		Object.entries(positionMap).forEach(([groupName, position]) => {
			const group = this.root.children.find(child => child.name === groupName);
			if (group) {
				group.traverse((child) => {
					if (child.type === 'Mesh') {
						const meshPart = this.meshList.find(item => item.mesh === child);
						if (meshPart) {
							meshPart.spTransform = { position };
						}
					}
				});
			}
		});


	}

	public update( deltaTime: number ) {

		if ( ! this.root.visible ) return;

		this.meshList.forEach( item => {

			item.update( deltaTime );

		} );

	}

	public hover( args: ORE.TouchEventArgs, camera: THREE.PerspectiveCamera ) {

		this.meshList.forEach( item => {

			item.hover( args, camera );

		} );

	}

	public switchVisibility( visible: boolean ) {

		if ( visible ) this.root.visible = true;

		this.animator.animate( 'sec1LogoVisibility', visible ? 1 : 0, 1, () => {

			if ( ! visible ) this.root.visible = false;

		} );

	}

	public resize( info: ORE.LayerInfo ) {

		this.meshList.forEach( item=> {

			item.resize( info );

		} );

	}

}
